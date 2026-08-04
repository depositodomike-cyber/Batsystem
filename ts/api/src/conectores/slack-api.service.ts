import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from '@/ai/crypto';

export interface SlackChannel {
  id: string;
  name: string;
  numMembers: number | null;
}

/**
 * Uma conversa do workspace, já normalizada. É o contrato que a página
 * /<produto>/slack consome (ts/demo/src/app/data/slack.ts) — sem as mensagens,
 * que são lidas sob demanda ao abrir a conversa.
 */
export interface SlackConversaItem {
  id: string;
  tipo: 'canal' | 'grupo' | 'dm';
  /** Nome sem o "#" nos canais; nome das pessoas nas conversas em grupo e DMs. */
  nome: string;
  topico?: string;
  privado?: boolean;
  membros?: number;
}

export interface SlackRespostaItem {
  id: string;
  autor: string;
  /** ISO 8601. */
  data: string;
  texto: string;
}

export interface SlackMensagemItem extends SlackRespostaItem {
  reacoes?: { emoji: string; total: number }[];
  respostas?: SlackRespostaItem[];
}

interface SlackListResponse {
  ok: boolean;
  error?: string;
  channels?: Array<{ id: string; name: string; num_members?: number }>;
}

interface SlackPostResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
}

/** Conversa crua de `users.conversations`. */
interface SlackRawConversation {
  id: string;
  name?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  /** Só em DM individual: o outro lado da conversa. */
  user?: string;
  num_members?: number;
  topic?: { value?: string };
  purpose?: { value?: string };
}

interface SlackConversationsResponse {
  ok: boolean;
  error?: string;
  channels?: SlackRawConversation[];
}

/** Mensagem crua de `conversations.history` / `conversations.replies`. */
interface SlackRawMessage {
  type?: string;
  subtype?: string;
  ts?: string;
  thread_ts?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text?: string;
  reply_count?: number;
  reactions?: { name?: string; count?: number }[];
}

interface SlackHistoryResponse {
  ok: boolean;
  error?: string;
  messages?: SlackRawMessage[];
}

interface SlackAuthTestResponse {
  ok: boolean;
  error?: string;
  /** Nome do bot no workspace — o que vai depois do "@" no /invite. */
  user?: string;
}

interface SlackUserInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    name?: string;
    real_name?: string;
    profile?: { real_name?: string; display_name?: string };
  };
}

/** Teto de mensagens por conversa (o Slack cobra uma chamada por thread). */
const LIMITE_MAX = 100;
const LIMITE_PADRAO = 50;
/** Threads lidas em paralelo — evita o rate limit (tier 3) do Slack. */
const CONCORRENCIA = 5;
/** Respostas lidas por thread. */
const RESPOSTAS_MAX = 50;

/**
 * Cache de nome de usuário por workspace. Um canal repete os mesmos autores em
 * quase toda mensagem, e `users.info` é uma chamada por id — sem cache, abrir
 * uma conversa custaria dezenas de requisições.
 */
const CACHE_USUARIOS_TTL_MS = 10 * 60 * 1000;

/** Emoji mais comuns nas reações — o Slack só devolve o shortcode. */
const EMOJI: Record<string, string> = {
  '+1': '👍',
  '-1': '👎',
  thumbsup: '👍',
  thumbsdown: '👎',
  ok_hand: '👌',
  clap: '👏',
  raised_hands: '🙌',
  pray: '🙏',
  eyes: '👀',
  rocket: '🚀',
  fire: '🔥',
  tada: '🎉',
  heavy_check_mark: '✔️',
  white_check_mark: '✅',
  x: '❌',
  warning: '⚠️',
  heart: '❤️',
  smile: '😄',
  joy: '😂',
  thinking_face: '🤔',
  crossed_fingers: '🤞',
  muscle: '💪',
  bulb: '💡',
  chart_with_upwards_trend: '📈',
  memo: '📝',
  point_up: '☝️',
  100: '💯',
};

/** "1690000000.000100" → ISO 8601. */
function tsParaIso(ts: string | undefined): string {
  const segundos = Number((ts ?? '').split('.')[0]);
  const ms = Number.isFinite(segundos) ? segundos * 1000 : Date.now();
  return new Date(ms).toISOString();
}

/** "mpdm-ana--bruno--carla-1" → "ana, bruno e carla". */
function nomeDeGrupo(raw: string): string {
  const partes = raw
    .replace(/^mpdm-/, '')
    .replace(/-\d+$/, '')
    .split('--')
    .filter(Boolean);
  if (partes.length === 0) return 'Conversa em grupo';
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * Chamadas reais à API do Slack usando o bot token OAuth do tenant
 * (EmpresaConector.accessTokenEncrypted). Consumido pelas ferramentas MCP.
 */
@Injectable()
export class SlackApiService {
  private readonly logger = new Logger(SlackApiService.name);

  /** empresaId → (userId → nome), com validade curta. */
  private readonly usuarios = new Map<
    string,
    { expiraEm: number; nomes: Map<string, string> }
  >();

  /** empresaId → nome da conta autorizada, com a mesma validade. */
  private readonly contas = new Map<
    string,
    { expiraEm: number; nome: string }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Token do tenant, ou erro orientando a conectar via OAuth no app.
   *
   * `comoUsuario` escolhe o token da pessoa que autorizou (OAuth v2
   * `authed_user`) em vez do de bot. Toda leitura de conversa usa esse: o de
   * bot só enxerga os canais em que o app foi adicionado, e as DMs que ele vê
   * são as do próprio app com cada pessoa — vazias, nunca as da pessoa.
   */
  private async getToken(
    empresaId: string,
    comoUsuario = false,
  ): Promise<string> {
    const vinculo = await this.prisma.empresaConector.findUnique({
      where: { empresaId_connectorId: { empresaId, connectorId: 'slack' } },
    });
    if (!vinculo?.accessTokenEncrypted) {
      throw new BadRequestException(
        'O Slack ainda não foi autorizado para esta empresa. ' +
          'No app beculture, abra Conectores → Slack → Conectar e autorize o workspace.',
      );
    }
    if (comoUsuario) {
      // Quem autorizou antes de a leitura em nome da pessoa existir só tem o
      // token de bot guardado — não há como pedir o de usuário sem nova volta
      // pelo Slack.
      if (!vinculo.userTokenEncrypted) {
        throw new BadRequestException(
          'A autorização atual do Slack não cobre as suas conversas — ela só ' +
            'permite publicar. Abra Conectores → Slack, desconecte e conecte ' +
            'de novo para autorizar a leitura das suas conversas.',
        );
      }
      return this.crypto.decrypt(vinculo.userTokenEncrypted);
    }
    return this.crypto.decrypt(vinculo.accessTokenEncrypted);
  }

  private async call<T extends { ok: boolean; error?: string }>(
    empresaId: string,
    method: string,
    params: Record<string, string>,
    comoUsuario = false,
  ): Promise<T> {
    const token = await this.getToken(empresaId, comoUsuario);
    let data: T;
    try {
      const res = await fetch(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });
      data = (await res.json()) as T;
    } catch (err) {
      this.logger.error(err);
      throw new ServiceUnavailableException(
        'Falha ao falar com o Slack. Tente novamente.',
      );
    }
    if (!data.ok) {
      // `missing_scope` acontece com quem autorizou antes de a leitura existir:
      // o token guardado não tem os escopos de histórico. Só reconectando.
      if (data.error === 'missing_scope' || data.error === 'not_authed') {
        throw new BadRequestException(
          'A autorização do Slack não cobre a leitura das conversas. ' +
            'Abra Conectores → Slack, desconecte e conecte de novo para ' +
            'autorizar os novos acessos.',
        );
      }
      throw new BadRequestException(
        `O Slack retornou um erro: ${data.error ?? 'desconhecido'}.`,
      );
    }
    return data;
  }

  async listChannels(empresaId: string): Promise<SlackChannel[]> {
    const data = await this.call<SlackListResponse>(
      empresaId,
      'conversations.list',
      { types: 'public_channel', limit: '200', exclude_archived: 'true' },
    );
    return (data.channels ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      numMembers: c.num_members ?? null,
    }));
  }

  // ---------- leitura do workspace (página /<produto>/slack) ----------

  /**
   * As conversas da pessoa que autorizou: canais (públicos e privados) em que
   * ela está, conversas em grupo e DMs.
   *
   * `users.conversations` com o token dela devolve exatamente o que ela vê no
   * Slack — por isso não é preciso adicionar o app a canal nenhum.
   */
  async listConversas(empresaId: string): Promise<SlackConversaItem[]> {
    const data = await this.call<SlackConversationsResponse>(
      empresaId,
      'users.conversations',
      {
        types: 'public_channel,private_channel,mpim,im',
        limit: '200',
        exclude_archived: 'true',
      },
      true,
    );
    const cruas = (data.channels ?? []).filter((c) => !c.is_archived);

    // Nome do outro lado das DMs — uma chamada por pessoa, com cache.
    const nomes = await this.nomesDeUsuario(
      empresaId,
      cruas.filter((c) => c.is_im && c.user).map((c) => c.user!),
    );

    const conversas = cruas.map((c) => this.mapConversa(c, nomes));
    // Canais primeiro, depois grupos e DMs — mesma ordem das seções da tela.
    const peso = { canal: 0, grupo: 1, dm: 2 };
    return conversas.sort(
      (a, b) =>
        peso[a.tipo] - peso[b.tipo] ||
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
    );
  }

  /**
   * Nome da conta cujas conversas estão sendo lidas (`auth.test` com o token
   * dela) — a tela mostra de quem é o workspace que aparece ali. Nunca derruba
   * a listagem: sem o nome, a tela cai num texto genérico.
   */
  async nomeDaConta(empresaId: string): Promise<string | null> {
    const cache = this.contas.get(empresaId);
    if (cache && cache.expiraEm > Date.now()) return cache.nome;
    try {
      const data = await this.call<SlackAuthTestResponse>(
        empresaId,
        'auth.test',
        {},
        true,
      );
      if (!data.user) return null;
      this.contas.set(empresaId, {
        expiraEm: Date.now() + CACHE_USUARIOS_TTL_MS,
        nome: data.user,
      });
      return data.user;
    } catch (err) {
      this.logger.warn('Slack: falha ao ler a conta autorizada');
      this.logger.warn(err);
      return null;
    }
  }

  private mapConversa(
    c: SlackRawConversation,
    nomes: Map<string, string>,
  ): SlackConversaItem {
    const topico = (c.topic?.value || c.purpose?.value || '').trim();

    if (c.is_im) {
      return {
        id: c.id,
        tipo: 'dm',
        nome: (c.user && nomes.get(c.user)) || 'Mensagem direta',
      };
    }
    if (c.is_mpim) {
      return {
        id: c.id,
        tipo: 'grupo',
        nome: nomeDeGrupo(c.name ?? ''),
        ...(c.num_members ? { membros: c.num_members } : {}),
      };
    }
    return {
      id: c.id,
      tipo: 'canal',
      nome: c.name ?? c.id,
      ...(topico ? { topico } : {}),
      ...(c.is_private ? { privado: true } : {}),
      ...(c.num_members ? { membros: c.num_members } : {}),
    };
  }

  /**
   * Últimas mensagens de uma conversa, da mais antiga para a mais recente (a
   * tela lista em ordem de leitura). Mensagens com thread trazem as respostas
   * junto — é uma chamada extra por thread, daí o teto de mensagens.
   */
  async listMensagens(
    empresaId: string,
    canalId: string,
    limite = LIMITE_PADRAO,
  ): Promise<SlackMensagemItem[]> {
    const max = Math.min(
      Math.max(1, Math.trunc(limite) || LIMITE_PADRAO),
      LIMITE_MAX,
    );
    const data = await this.call<SlackHistoryResponse>(
      empresaId,
      'conversations.history',
      { channel: canalId, limit: String(max) },
      true,
    );

    // Fora as mensagens de sistema ("fulano entrou no canal") e as respostas
    // que o histórico às vezes devolve soltas — elas aparecem na thread.
    const mensagens = (data.messages ?? []).filter(
      (m) =>
        !m.subtype &&
        (m.text ?? '').trim() !== '' &&
        (!m.thread_ts || m.thread_ts === m.ts),
    );

    const threads = await this.lerThreads(empresaId, canalId, mensagens);

    // Autores das mensagens e de todas as respostas, num lote só.
    const ids = new Set<string>();
    for (const m of mensagens) if (m.user) ids.add(m.user);
    for (const respostas of threads.values())
      for (const r of respostas) if (r.user) ids.add(r.user);
    const nomes = await this.nomesDeUsuario(empresaId, [...ids]);

    return mensagens
      .map((m) => {
        const respostas = (threads.get(m.ts ?? '') ?? []).map((r) =>
          this.mapResposta(canalId, r, nomes),
        );
        const reacoes = (m.reactions ?? [])
          .filter((r) => r.name)
          .map((r) => ({
            emoji: EMOJI[r.name!] ?? `:${r.name!}:`,
            total: r.count ?? 0,
          }));
        return {
          ...this.mapResposta(canalId, m, nomes),
          ...(reacoes.length ? { reacoes } : {}),
          ...(respostas.length ? { respostas } : {}),
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  private mapResposta(
    canalId: string,
    m: SlackRawMessage,
    nomes: Map<string, string>,
  ): SlackRespostaItem {
    return {
      // O `ts` só é único dentro do canal, e a tela guarda no navegador o que
      // já foi para a Memória — o id precisa ser único no workspace inteiro.
      id: `${canalId}-${m.ts ?? ''}`,
      autor:
        (m.user && nomes.get(m.user)) || m.username || (m.bot_id ? 'App' : '—'),
      data: tsParaIso(m.ts),
      texto: this.formatarTexto(m.text ?? '', nomes),
    };
  }

  /** Respostas de cada mensagem que tem thread, indexadas pelo `ts` do pai. */
  private async lerThreads(
    empresaId: string,
    canalId: string,
    mensagens: SlackRawMessage[],
  ): Promise<Map<string, SlackRawMessage[]>> {
    const comThread = mensagens.filter((m) => (m.reply_count ?? 0) > 0 && m.ts);
    const resultado = new Map<string, SlackRawMessage[]>();

    for (let i = 0; i < comThread.length; i += CONCORRENCIA) {
      await Promise.all(
        comThread.slice(i, i + CONCORRENCIA).map(async (m) => {
          try {
            const data = await this.call<SlackHistoryResponse>(
              empresaId,
              'conversations.replies',
              { channel: canalId, ts: m.ts!, limit: String(RESPOSTAS_MAX) },
              true,
            );
            resultado.set(
              m.ts!,
              // O primeiro item é a própria mensagem-pai.
              (data.messages ?? []).filter(
                (r) => r.ts !== m.ts && !r.subtype && (r.text ?? '').trim(),
              ),
            );
          } catch (err) {
            // Uma thread ilegível não pode derrubar a conversa inteira: a
            // mensagem aparece sem as respostas.
            this.logger.warn(`Slack: falha ao ler a thread ${m.ts ?? ''}`);
            this.logger.warn(err);
          }
        }),
      );
    }
    return resultado;
  }

  /**
   * Marcação do Slack → texto legível: menções viram "@Nome", canais viram
   * "#canal" e links ficam só com o rótulo.
   */
  private formatarTexto(texto: string, nomes: Map<string, string>): string {
    return texto
      .replace(/<@([UW][A-Z0-9]+)(\|[^>]*)?>/g, (_, id: string) => {
        return `@${nomes.get(id) ?? id}`;
      })
      .replace(/<#[CG][A-Z0-9]+\|([^>]*)>/g, (_, nome: string) => `#${nome}`)
      .replace(/<!(here|channel|everyone)>/g, (_, alvo: string) => `@${alvo}`)
      .replace(/<(?:mailto:)?([^|>]+)\|([^>]*)>/g, (_, url: string, rotulo: string) =>
        rotulo || url,
      )
      .replace(/<((?:https?|mailto):[^|>]+)>/g, (_, url: string) =>
        url.replace(/^mailto:/, ''),
      )
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /** userId → nome de exibição, com cache por empresa. */
  private async nomesDeUsuario(
    empresaId: string,
    ids: string[],
  ): Promise<Map<string, string>> {
    const agora = Date.now();
    let cache = this.usuarios.get(empresaId);
    if (!cache || cache.expiraEm < agora) {
      cache = { expiraEm: agora + CACHE_USUARIOS_TTL_MS, nomes: new Map() };
      this.usuarios.set(empresaId, cache);
    }

    const faltando = [...new Set(ids)].filter((id) => !cache!.nomes.has(id));
    for (let i = 0; i < faltando.length; i += CONCORRENCIA) {
      await Promise.all(
        faltando.slice(i, i + CONCORRENCIA).map(async (id) => {
          try {
            const data = await this.call<SlackUserInfoResponse>(
              empresaId,
              'users.info',
              { user: id },
              true,
            );
            const u = data.user;
            const nome =
              u?.profile?.real_name ||
              u?.real_name ||
              u?.profile?.display_name ||
              u?.name;
            if (nome) cache!.nomes.set(id, nome);
          } catch (err) {
            // Sem o nome a conversa continua legível — fica o id do Slack.
            this.logger.warn(`Slack: falha ao ler o usuário ${id}`);
            this.logger.warn(err);
          }
        }),
      );
    }
    return cache.nomes;
  }

  // ---------- escrita (ferramentas MCP) ----------

  /** Envia mensagem; `canal` aceita id (C0123…) ou nome (#geral / geral). */
  async postMessage(
    empresaId: string,
    canal: string,
    texto: string,
  ): Promise<{ canal: string; ts: string }> {
    const data = await this.call<SlackPostResponse>(
      empresaId,
      'chat.postMessage',
      { channel: canal.replace(/^#/, ''), text: texto },
    );
    return { canal: data.channel ?? canal, ts: data.ts ?? '' };
  }
}
