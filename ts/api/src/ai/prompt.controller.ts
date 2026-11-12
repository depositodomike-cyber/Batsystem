import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { HistoricoTurno } from './prompt/framework';
import {
  PromptService,
  type MencaoAgente,
  type PromptResposta,
  type UploadedFileLike,
} from './prompt.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import { OrganizacaoAtual } from '@/common/organizacao-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface PromptBody {
  texto?: string;
  modo?: string;
  historico?: string; // JSON string: HistoricoTurno[]
  referencia?: string; // Notas/Insights/To-do's coletados no cliente
  conversaId?: string;
  repositorioId?: string;
  /** Agente que participa deste turno. Ausente = o Assistente padrão. */
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
function parseMencoes(raw: string | undefined): MencaoAgente[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (m): m is MencaoAgente =>
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

/**
 * Camada HTTP do Assistente: lê o corpo (JSON ou multipart) e delega ao
 * PromptService, onde está toda a lógica.
 */
@Controller('ai')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  /**
   * POST /ai/prompt → "Pergunte à sua Memória".
   * Aceita JSON ou multipart (com `arquivo`). Campos: texto (obrigatório),
   * modo ('vault'|'web'|'auto'), historico (JSON), referencia (texto do cliente).
   * Retorna { tipo:'resposta', resposta, fontes, origem }.
   */
  @Post('prompt')
  @UseGuards(JwtAuthGuard, PermissoesGuard)
  @RequerPermissao('ia.usar')
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
    return this.promptService.responder({
      user,
      texto: body.texto ?? '',
      modo: body.modo,
      historico: parseHistorico(body.historico),
      referencia: body.referencia,
      conversaId: body.conversaId,
      // O corpo já mandava o repositório (usado para gravar a conversa); o
      // header é a fonte nova, comum a todos os endpoints. Preferimos o corpo
      // quando ele vem, para não mudar o comportamento de quem já o envia.
      repositorioId:
        (body.repositorioId || '').trim() || repositorioDoHeader || undefined,
      organizacaoId,
      agenteId: body.agenteId,
      mencoes: parseMencoes(body.mencoes),
      respostaAdicional: body.respostaAdicional === '1',
      arquivo,
    });
  }
}
