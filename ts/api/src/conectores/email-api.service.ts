import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OauthProviderService } from './oauth-provider.service';
import { getProviderJson } from './provider-fetch';

/**
 * Um e-mail da caixa de entrada, já normalizado. É exatamente o contrato que
 * a página /<produto>/email consome (ts/demo/src/app/data/emails.ts) — Gmail e
 * Outlook são traduzidos para cá, então a UI não sabe de qual provedor veio.
 */
export interface EmailItem {
  id: string;
  remetenteNome: string;
  remetenteEmail: string;
  para: string;
  assunto: string;
  /** ISO 8601. */
  data: string;
  /** Corpo em texto puro. */
  corpo: string;
  anexos?: { nome: string; tamanho: number }[];
  /** Marcadores do provedor (labels do Gmail, categorias do Outlook). */
  marcadores?: string[];
  /** Ainda não lido na caixa do provedor. */
  naoLido?: boolean;
}

/** Teto de mensagens por requisição — o Gmail cobra um GET por mensagem. */
const LIMITE_MAX = 50;
const LIMITE_PADRAO = 25;
/** Requisições simultâneas ao provedor (evita 429 do Gmail). */
const CONCORRENCIA = 8;

/**
 * Labels de sistema do Gmail que não interessam como "marcador" na UI —
 * estado (lido/importante) e caixas já representados de outra forma.
 */
const GMAIL_LABELS_IGNORADAS = new Set([
  'INBOX',
  'UNREAD',
  'STARRED',
  'IMPORTANT',
  'SENT',
  'DRAFT',
  'SPAM',
  'TRASH',
  'CHAT',
]);

const GMAIL_CATEGORIAS: Record<string, string> = {
  CATEGORY_PERSONAL: 'Principal',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_PROMOTIONS: 'Promoções',
  CATEGORY_UPDATES: 'Atualizações',
  CATEGORY_FORUMS: 'Fóruns',
};

// ---------- helpers de parsing ----------

/** "Camila Ferraz <camila@x.com>" → nome e e-mail separados. */
function parseRemetente(raw: string): { nome: string; email: string } {
  const valor = (raw ?? '').trim();
  const match = /^(.*?)\s*<([^>]+)>$/.exec(valor);
  if (match) {
    const nome = match[1].replace(/^"|"$/g, '').trim();
    const email = match[2].trim();
    return { nome: nome || email, email };
  }
  return { nome: valor, email: valor };
}

/** HTML → texto legível (o corpo da UI é texto puro com quebras de linha). */
function htmlParaTexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Roda `tarefas` em lotes para não estourar o rate limit do provedor. */
async function emLotes<T, R>(
  itens: T[],
  tamanho: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultado: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultado.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))));
  }
  return resultado;
}

// ---------- tipos crus dos provedores ----------

interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
}

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  categories?: string[];
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  body?: { contentType?: string; content?: string };
}

/**
 * Leitura da caixa de entrada real do tenant, usando o token OAuth já
 * guardado pelo OauthProviderService (que renova sozinho quando expira).
 *
 * Gmail exige um GET por mensagem (a listagem devolve só ids), então a
 * listagem é paginada em lotes; o Graph devolve tudo numa requisição só.
 */
@Injectable()
export class EmailApiService {
  private readonly logger = new Logger(EmailApiService.name);

  constructor(private readonly oauth: OauthProviderService) {}

  /** Últimos e-mails da caixa de entrada, do mais recente para o mais antigo. */
  async listInbox(
    empresaId: string,
    provedor: string,
    limite = LIMITE_PADRAO,
  ): Promise<EmailItem[]> {
    const max = Math.min(
      Math.max(1, Math.trunc(limite) || LIMITE_PADRAO),
      LIMITE_MAX,
    );
    const token = await this.oauth.getAccessToken(empresaId, provedor, 'email');
    if (provedor === 'gmail') return this.listGmail(token, max);
    if (provedor === 'outlook') return this.listOutlook(token, max);
    // Provedor desconhecido já falha em getAccessToken; guarda de tipo.
    throw new BadRequestException(`Provedor "${provedor}" não lê e-mails.`);
  }

  // ---------- Gmail ----------

  private async listGmail(token: string, max: number): Promise<EmailItem[]> {
    const lista = await this.getJson<{ messages?: { id: string }[] }>(
      'Gmail',
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=INBOX`,
      token,
    );
    const ids = (lista.messages ?? []).map((m) => m.id);
    if (ids.length === 0) return [];

    const labels = await this.gmailLabels(token);
    const mensagens = await emLotes(ids, CONCORRENCIA, (id) =>
      this.getJson<GmailMessage>(
        'Gmail',
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        token,
      ).catch((err) => {
        // Uma mensagem apagada entre a listagem e o GET não pode derrubar
        // a caixa inteira — some da lista e o resto continua.
        this.logger.warn(`Gmail: falha ao ler a mensagem ${id}`);
        this.logger.warn(err);
        return null;
      }),
    );

    return mensagens
      .filter((m): m is GmailMessage => m !== null)
      .map((m) => this.mapGmail(m, labels))
      .sort((a, b) => b.data.localeCompare(a.data));
  }

  /** id → nome legível das labels da conta (o Gmail só devolve os ids). */
  private async gmailLabels(token: string): Promise<Map<string, string>> {
    try {
      const data = await this.getJson<{
        labels?: { id: string; name: string }[];
      }>(
        'Gmail',
        'https://gmail.googleapis.com/gmail/v1/users/me/labels',
        token,
      );
      return new Map((data.labels ?? []).map((l) => [l.id, l.name]));
    } catch (err) {
      // Sem os nomes a caixa continua legível — só perde os marcadores.
      this.logger.warn('Gmail: não foi possível ler as labels da conta');
      this.logger.warn(err);
      return new Map();
    }
  }

  private mapGmail(m: GmailMessage, labels: Map<string, string>): EmailItem {
    const headers = new Map(
      (m.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
    );
    const { nome, email } = parseRemetente(headers.get('from') ?? '');
    const dataHeader = headers.get('date');
    const data = m.internalDate
      ? new Date(Number(m.internalDate)).toISOString()
      : new Date(dataHeader ?? Date.now()).toISOString();

    const anexos: { nome: string; tamanho: number }[] = [];
    const corpo = this.gmailCorpo(m.payload, anexos);

    return {
      id: m.id,
      remetenteNome: nome || email || '(sem remetente)',
      remetenteEmail: email,
      para: headers.get('to') ?? '',
      assunto: headers.get('subject') ?? '(sem assunto)',
      data,
      corpo: corpo || (m.snippet ?? ''),
      ...(anexos.length ? { anexos } : {}),
      marcadores: (m.labelIds ?? [])
        .filter((id) => !GMAIL_LABELS_IGNORADAS.has(id))
        .map((id) => GMAIL_CATEGORIAS[id] ?? labels.get(id) ?? null)
        .filter((n): n is string => !!n),
      naoLido: (m.labelIds ?? []).includes('UNREAD'),
    };
  }

  /**
   * Percorre o MIME em profundidade coletando anexos e o melhor corpo:
   * text/plain quando existe, senão o text/html convertido.
   */
  private gmailCorpo(
    part: GmailPart | undefined,
    anexos: { nome: string; tamanho: number }[],
  ): string {
    if (!part) return '';
    let texto = '';
    let html = '';

    const visitar = (p: GmailPart) => {
      if (p.filename) {
        anexos.push({ nome: p.filename, tamanho: p.body?.size ?? 0 });
        return; // anexo não entra no corpo, mesmo sendo text/*
      }
      const conteudo = p.body?.data
        ? Buffer.from(p.body.data, 'base64url').toString('utf8')
        : '';
      if (p.mimeType === 'text/plain' && !texto) texto = conteudo;
      else if (p.mimeType === 'text/html' && !html) html = conteudo;
      for (const filho of p.parts ?? []) visitar(filho);
    };
    visitar(part);

    return (texto || htmlParaTexto(html)).trim();
  }

  // ---------- Outlook (Microsoft Graph) ----------

  private async listOutlook(token: string, max: number): Promise<EmailItem[]> {
    const url =
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages' +
      `?$top=${max}&$orderby=receivedDateTime desc` +
      '&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,hasAttachments,categories,isRead';
    const data = await this.getJson<{ value?: GraphMessage[] }>(
      'Outlook',
      url,
      token,
    );
    const mensagens = data.value ?? [];

    // Só quem tem anexo paga a requisição extra (o Graph não traz na lista).
    const anexosPorId = new Map<string, { nome: string; tamanho: number }[]>();
    const comAnexo = mensagens.filter((m) => m.hasAttachments).map((m) => m.id);
    await emLotes(comAnexo, CONCORRENCIA, async (id) => {
      try {
        const res = await this.getJson<{
          value?: { name?: string; size?: number }[];
        }>(
          'Outlook',
          `https://graph.microsoft.com/v1.0/me/messages/${id}/attachments?$select=name,size`,
          token,
        );
        anexosPorId.set(
          id,
          (res.value ?? []).map((a) => ({
            nome: a.name ?? 'anexo',
            tamanho: a.size ?? 0,
          })),
        );
      } catch (err) {
        this.logger.warn(`Outlook: falha ao listar anexos de ${id}`);
        this.logger.warn(err);
      }
    });

    return mensagens.map((m) => this.mapOutlook(m, anexosPorId.get(m.id)));
  }

  private mapOutlook(
    m: GraphMessage,
    anexos: { nome: string; tamanho: number }[] | undefined,
  ): EmailItem {
    const de = m.from?.emailAddress ?? {};
    const bruto = m.body?.content ?? '';
    const corpo =
      m.body?.contentType?.toLowerCase() === 'html'
        ? htmlParaTexto(bruto)
        : bruto.trim();

    return {
      id: m.id,
      remetenteNome: de.name || de.address || '(sem remetente)',
      remetenteEmail: de.address ?? '',
      para: (m.toRecipients ?? [])
        .map((t) => t.emailAddress?.address ?? '')
        .filter(Boolean)
        .join(', '),
      assunto: m.subject || '(sem assunto)',
      data: new Date(m.receivedDateTime ?? Date.now()).toISOString(),
      corpo: corpo || (m.bodyPreview ?? ''),
      ...(anexos?.length ? { anexos } : {}),
      marcadores: m.categories ?? [],
      naoLido: m.isRead === false,
    };
  }

  // ---------- infra ----------

  /** GET autenticado na API do provedor (erros já traduzidos para a UI). */
  private getJson<T>(label: string, url: string, token: string): Promise<T> {
    return getProviderJson<T>(
      { logger: this.logger, label, recurso: 'à caixa de entrada' },
      url,
      token,
    );
  }
}
