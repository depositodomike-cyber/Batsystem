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
import { VaultService } from '@/vault/vault.service';
import { ConversasService } from '@/conversas/conversas.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
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
}

/** Fonte da resposta: caminho/título (Memória) ou página web citada. */
type Fonte = string | { titulo: string; url: string };

interface PromptResposta {
  tipo: 'resposta';
  resposta: string;
  fontes: Fonte[];
  origem: 'vault' | 'web';
  conversaId?: string;
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
    const repositorioId = (body.repositorioId || '').trim() || undefined;
    const modoPedido = modo;

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
      titulosVault = await this.vault.titulos(user.empresaId, texto, 40);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    // Modo Web: busca na internet com fontes citadas. Anexo é ignorado no Web
    // (igual ao Confi).
    if (modo === 'web') {
      const { text, fontes, truncated } = await this.ai.completarWeb(
        user.empresaId,
        user.id,
        SYSTEM_WEB,
        buildWebUser({ texto, historico, titulosVault }),
        4000,
      );
      let resposta = text.trim();
      if (truncated) resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
      const conversaId = await this.persistirPrompt({
        user,
        conversaId: conversaIdIn,
        repositorioId,
        modo: modoPedido,
        pergunta: texto,
        resposta,
        fontes,
        origem: 'web',
      });
      return { tipo: 'resposta', resposta, fontes, origem: 'web', conversaId };
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
    let notasBloco = '';
    let titulosNotas: string[] = [];
    try {
      // Busca uma margem além do teto para o orçamento poder escolher.
      const hits = await this.vault.search(
        user.empresaId,
        texto,
        MEMORIA_MAX_NOTAS + 2,
      );
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
      SYSTEM_VAULT,
      userPrompt,
      4000,
    );

    const { resposta: limpa, fontes: citadas } = extrairFontesVault(text);
    // Só devolvemos como fonte títulos de notas que existem de fato (o modelo
    // pode alucinar nomes). Se nada casou, não mostramos fontes.
    const setNotas = new Set(titulosNotas.map((t) => t.toLowerCase()));
    const fontes: Fonte[] = citadas.filter((c) => setNotas.has(c.toLowerCase()));
    if (anexo && arquivo) fontes.unshift(`Anexo: ${arquivo.originalname}`);

    let resposta = limpa;
    if (truncated) resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
    const conversaId = await this.persistirPrompt({
      user,
      conversaId: conversaIdIn,
      repositorioId,
      modo: modoPedido,
      pergunta: texto,
      resposta,
      fontes,
      origem: 'vault',
    });
    return { tipo: 'resposta', resposta, fontes, origem: 'vault', conversaId };
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
  }): Promise<string | undefined> {
    try {
      const { conversaId, nova } = await this.conversas.persistPromptTurn({
        empresaId: params.user.empresaId,
        usuarioId: params.user.id,
        conversaId: params.conversaId,
        repositorioId: params.repositorioId,
        modo: params.modo,
        pergunta: params.pergunta,
        resposta: params.resposta,
        fontes: params.fontes,
        origemResposta: params.origem,
      });
      if (nova) this.refinarTitulo(params.user, conversaId, params.pergunta, params.resposta);
      return conversaId;
    } catch (err) {
      this.logger.warn(`Falha ao persistir conversa do Prompt: ${String(err)}`);
      return params.conversaId;
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
