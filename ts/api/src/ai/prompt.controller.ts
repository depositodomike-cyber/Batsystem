import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { extrairTexto } from './analise/extrair-texto';
import {
  buildVaultUser,
  buildWebUser,
  extrairFontesVault,
  montarBlocoMemoria,
  MEMORIA_MAX_NOTAS,
  SYSTEM_ROTA,
  SYSTEM_VAULT,
  SYSTEM_WEB,
  type HistoricoTurno,
  type ModoBusca,
} from './prompt/framework';
import {
  extrairArquivos,
  REGRA_ARQUIVO,
  type ArquivoConversa,
} from './prompt/arquivos';
import { VaultService } from '@/vault/vault.service';
import { RepositorioOrgService } from '@/repositorio-org/repositorio-org.service';
import { ConversasService } from '@/conversas/conversas.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import { OrganizacaoAtual } from '@/common/organizacao-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface PromptBody {
  texto?: string;
  modo?: string;
  historico?: string; // JSON string: HistoricoTurno[]
  referencia?: string; // Notas/Insights/To-do's coletados no cliente
  conversaId?: string;
  repositorioId?: string;
  /**
   * Agente (o antigo "squad") que participa deste turno. Ausente = o
   * Assistente padrão. O agente só muda a voz e a especialização: o contexto
   * (Repositório, vault, referências) continua o do usuário — agente não
   * eleva permissão.
   */
  agenteId?: string;
  /**
   * Agentes mencionados na pergunta (JSON string: {id, titulo, mencao}[]). Vai
   * para o `meta` da mensagem do usuário, para a menção continuar
   * identificável ao reabrir a conversa.
   */
  mencoes?: string;
  /**
   * '1' = este turno é a resposta de MAIS UM agente à mesma pergunta (vários
   * @mencionados): grava só a resposta, sem repetir a mensagem do usuário.
   */
  respostaAdicional?: string;
}

/** Agentes mencionados, validados no formato mínimo. */
function parseMencoes(
  raw: string | undefined,
): { id: string; titulo: string; mencao: string }[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (m): m is { id: string; titulo: string; mencao: string } =>
          !!m &&
          typeof (m as { id?: unknown }).id === 'string' &&
          typeof (m as { titulo?: unknown }).titulo === 'string' &&
          typeof (m as { mencao?: unknown }).mencao === 'string',
      )
      .slice(0, 10)
      .map((m) => ({
        id: m.id.slice(0, 120),
        titulo: m.titulo.slice(0, 80),
        mencao: m.mencao.slice(0, 41),
      }));
  } catch {
    return [];
  }
}

/** Fonte da resposta: caminho/título (Memória) ou página web citada. */
type Fonte = string | { titulo: string; url: string };

interface PromptResposta {
  tipo: 'resposta';
  resposta: string;
  fontes: Fonte[];
  origem: 'vault' | 'web';
  conversaId?: string;
  /** Mensagem da resposta, para o cliente marcar um arquivo como salvo. */
  mensagemId?: string;
  /** Agente que produziu esta resposta (null = Assistente padrão). */
  agente: AgenteDoTurno | null;
  /** Arquivos gerados nesta resposta — pertencem à conversa. */
  arquivos: ArquivoConversa[];
}

interface AgenteDoTurno {
  id: string;
  titulo: string;
}

function parseHistorico(raw: string | undefined): HistoricoTurno[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (t): t is HistoricoTurno =>
          !!t &&
          typeof (t as HistoricoTurno).pergunta === 'string' &&
          typeof (t as HistoricoTurno).resposta === 'string',
      )
      .slice(-12);
  } catch {
    return [];
  }
}

@Controller('ai')
export class PromptController {
  private readonly logger = new Logger(PromptController.name);

  constructor(
    private readonly ai: AiService,
    private readonly vault: VaultService,
    private readonly repositorioOrg: RepositorioOrgService,
    private readonly conversas: ConversasService,
  ) {}

  /**
   * POST /ai/prompt → "Pergunte à sua Memória" (portado do beculture/Confi).
   * Aceita JSON ou multipart (com `arquivo`). Campos: texto (obrigatório),
   * modo ('vault'|'web'|'auto'), historico (JSON), referencia (texto do cliente).
   * Retorna { tipo:'resposta', resposta, fontes, origem }.
   */
  @Post('prompt')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async prompt(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioDoHeader: string | null,
    @OrganizacaoAtual() organizacaoId: string | null,
    @UploadedFile() arquivo: UploadedFileLike | undefined,
    @Body() body: PromptBody,
  ): Promise<PromptResposta> {
    const texto = (body.texto || '').trim();
    if (!texto) {
      throw new BadRequestException('Pergunta vazia.');
    }

    let modo: ModoBusca = (['vault', 'web', 'auto'] as const).includes(
      (body.modo || '').trim() as ModoBusca,
    )
      ? ((body.modo as string).trim() as ModoBusca)
      : 'vault';

    const historico = parseHistorico(body.historico);
    const referencia = (body.referencia || '').trim();
    const conversaIdIn = (body.conversaId || '').trim() || undefined;
    // O corpo já mandava o repositório (usado para gravar a conversa); o header
    // é a fonte nova, comum a todos os endpoints. Preferimos o corpo quando ele
    // vem, para não mudar o comportamento de quem já o envia.
    const repositorioId =
      (body.repositorioId || '').trim() || repositorioDoHeader || undefined;
    const modoPedido = modo;

    // Agente do turno: a persona vai NA FRENTE do system prompt do modo; as
    // regras de formato (Conexões, FONTES) seguem as mesmas. Agente inválido ou
    // inativo cai no Assistente padrão em vez de derrubar a pergunta.
    const agenteIdIn = (body.agenteId || '').trim();
    const persona = agenteIdIn
      ? await this.ai
          // Com o dono: agente personalizado só resolve se for DESTE usuário.
          .personaDoAgente(agenteIdIn, {
            empresaId: user.empresaId,
            usuarioId: user.id,
          })
          .catch((err: unknown) => {
            this.logger.warn(`Falha ao carregar o agente: ${String(err)}`);
            return null;
          })
      : null;
    const agente: AgenteDoTurno | null = persona
      ? { id: persona.id, titulo: persona.titulo }
      : null;
    const mencoes = parseMencoes(body.mencoes);
    const respostaAdicional = body.respostaAdicional === '1' && !!conversaIdIn;
    const comAgente = (system: string) =>
      persona ? `${persona.texto}\n\n---\n${system}${REGRA_ARQUIVO}` : system;
    // O arquivo pertence à conversa, mas registra QUEM o gerou.
    const separarArquivos = (bruta: string) => {
      if (!persona) {
        return { resposta: bruta, arquivos: [] as ArquivoConversa[] };
      }
      const r = extrairArquivos(bruta);
      return {
        resposta: r.resposta,
        arquivos: r.arquivos.map((a) => ({ ...a, geradoPor: agente })),
      };
    };

    // Modo Auto: o modelo decide entre Memória e Web.
    if (modo === 'auto') {
      try {
        // Sem diretrizes: este passo não gera resposta, só escolhe a fonte —
        // e as regras de conduta atrapalhariam a saída de uma palavra só.
        const cls = await this.ai.completar(
          user.empresaId,
          user.id,
          SYSTEM_ROTA,
          texto,
          8,
          'completar',
          { semDiretrizes: true },
        );
        modo = /web/i.test(cls.text) ? 'web' : 'vault';
      } catch (err) {
        this.logger.warn(`Falha ao classificar rota (Auto), assumindo Memória: ${String(err)}`);
        modo = 'vault';
      }
    }

    // Títulos das notas do vault: alvos dos [[wikilinks]] do bloco "Conexões no
    // Vault" que fecha a resposta (vale para os dois modos).
    let titulosVault: string[] = [];
    try {
      titulosVault = await this.vault.titulos(user.empresaId, repositorioId ?? null, texto, 40);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    // Modo Web: busca na internet com fontes citadas. Anexo é ignorado no Web
    // (igual ao Confi).
    if (modo === 'web') {
      const { text, fontes, truncated } = await this.ai.completarWeb(
        user.empresaId,
        user.id,
        comAgente(SYSTEM_WEB),
        buildWebUser({ texto, historico, titulosVault }),
        4000,
      );
      const separado = separarArquivos(text.trim());
      let resposta = separado.resposta;
      if (truncated) resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
      const salvo = await this.persistirPrompt({
        user,
        conversaId: conversaIdIn,
        repositorioId,
        modo: modoPedido,
        pergunta: texto,
        resposta,
        fontes,
        origem: 'web',
        agente,
        arquivos: separado.arquivos,
        mencoes,
        respostaAdicional,
      });
      return {
        tipo: 'resposta',
        resposta,
        fontes,
        origem: 'web',
        ...salvo,
        agente,
        arquivos: separado.arquivos,
      };
    }

    // Modo Memória (vault): referência do cliente + anexo opcional (arquivo de
    // texto lido aqui e injetado no contexto). As DIRETRIZES não são montadas
    // aqui: o AiService as anexa ao system prompt de toda chamada de IA.
    let anexo = '';
    if (arquivo) {
      try {
        anexo = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
      } catch (err) {
        this.logger.warn(`Falha ao ler anexo do Prompt: ${String(err)}`);
      }
    }

    // MEMÓRIA = notas .md do usuário (vault), recuperadas por relevância à
    // pergunta via busca textual do Postgres. É a base de conhecimento factual.
    // O bloco é o maior do prompt: `montarBlocoMemoria` recorta o trecho
    // relevante de cada nota sob um orçamento total de contexto (ver framework).
    //
    // Os documentos do Repositório da ORGANIZAÇÃO entram no mesmo bloco, na
    // frente: só voltam quando casam com a pergunta (sem fallback), enquanto
    // as notas do vault podem ser só "as mais recentes". Listagem ≠ contexto:
    // eles não aparecem na lista nem no grafo pessoal, mas a IA os lê.
    let notasBloco = '';
    let titulosNotas: string[] = [];
    try {
      // Busca uma margem além do teto para o orçamento poder escolher.
      const [daOrganizacao, doVault] = await Promise.all([
        this.repositorioOrg
          .search(user.empresaId, organizacaoId, texto)
          .catch((err: unknown) => {
            this.logger.warn(
              `Falha ao buscar no Repositório da organização: ${String(err)}`,
            );
            return [];
          }),
        this.vault.search(
          user.empresaId,
          repositorioId ?? null,
          texto,
          MEMORIA_MAX_NOTAS + 2,
        ),
      ]);
      const hits = [...daOrganizacao, ...doVault];
      const { bloco, titulos } = montarBlocoMemoria(hits, texto);
      notasBloco = bloco;
      titulosNotas = titulos;
    } catch (err) {
      this.logger.warn(`Falha ao recuperar notas do Vault: ${String(err)}`);
    }

    const userPrompt = buildVaultUser({
      texto,
      notasBloco,
      referencia,
      anexo,
      anexoNome: arquivo?.originalname,
      historico,
      titulosVault,
    });

    const { text, truncated } = await this.ai.completar(
      user.empresaId,
      user.id,
      comAgente(SYSTEM_VAULT),
      userPrompt,
      4000,
    );

    const { resposta: limpa, fontes: citadas } = extrairFontesVault(text);
    // Só devolvemos como fonte títulos de notas que existem de fato (o modelo
    // pode alucinar nomes). Se nada casou, não mostramos fontes.
    const setNotas = new Set(titulosNotas.map((t) => t.toLowerCase()));
    const fontes: Fonte[] = citadas.filter((c) => setNotas.has(c.toLowerCase()));
    if (anexo && arquivo) fontes.unshift(`Anexo: ${arquivo.originalname}`);

    const { resposta: semArquivos, arquivos } = separarArquivos(limpa);
    let resposta = semArquivos;
    if (truncated) resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
    const salvo = await this.persistirPrompt({
      user,
      conversaId: conversaIdIn,
      repositorioId,
      modo: modoPedido,
      pergunta: texto,
      resposta,
      fontes,
      origem: 'vault',
      agente,
      arquivos,
      mencoes,
      respostaAdicional,
    });
    return {
      tipo: 'resposta',
      resposta,
      fontes,
      origem: 'vault',
      ...salvo,
      agente,
      arquivos,
    };
  }

  private async persistirPrompt(params: {
    user: AuthenticatedUser;
    conversaId?: string;
    repositorioId?: string;
    modo: ModoBusca;
    pergunta: string;
    resposta: string;
    fontes: Fonte[];
    origem: 'vault' | 'web';
    agente: AgenteDoTurno | null;
    arquivos: ArquivoConversa[];
    mencoes: { id: string; titulo: string; mencao: string }[];
    respostaAdicional: boolean;
  }): Promise<{ conversaId?: string; mensagemId?: string }> {
    try {
      const { conversaId, nova, mensagemId } = await this.conversas.persistPromptTurn({
        empresaId: params.user.empresaId,
        usuarioId: params.user.id,
        conversaId: params.conversaId,
        repositorioId: params.repositorioId,
        modo: params.modo,
        pergunta: params.pergunta,
        resposta: params.resposta,
        fontes: params.fontes,
        origemResposta: params.origem,
        agente: params.agente,
        arquivos: params.arquivos,
        mencoes: params.mencoes,
        respostaAdicional: params.respostaAdicional,
      });
      if (nova) this.refinarTitulo(params.user, conversaId, params.pergunta, params.resposta);
      return { conversaId, mensagemId };
    } catch (err) {
      this.logger.warn(`Falha ao persistir conversa do Prompt: ${String(err)}`);
      return { conversaId: params.conversaId };
    }
  }

  private refinarTitulo(
    user: AuthenticatedUser,
    conversaId: string,
    pergunta: string,
    resposta: string,
  ): void {
    void this.ai
      .completar(
        user.empresaId,
        user.id,
        'Responda somente com um título curto de 4 a 6 palavras, em português, sem aspas e sem pontuação final, que resuma a conversa.',
        `Pergunta: ${pergunta}\nResposta: ${resposta.slice(0, 500)}`,
        24,
        'completar',
        { semDiretrizes: true },
      )
      .then(async (r) => {
        const titulo = r.text
          .trim()
          .replace(/^["'«»]+|["'«»]+$/g, '')
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        if (titulo.length < 3) return;
        await this.conversas.rename(user.empresaId, user.id, conversaId, titulo);
      })
      .catch((err) => {
        this.logger.warn(`Falha ao gerar título da conversa: ${String(err)}`);
      });
  }
}
