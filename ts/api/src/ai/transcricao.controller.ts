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
import {
  buildTranscricaoUser,
  parseAtaEstrategica,
  SYSTEM_TRANSCRICAO,
} from './transcricao/prompts';
import { extrairTexto } from './analise/extrair-texto';
import { MemoriasService } from '@/memorias/memorias.service';
import { InsightsService } from '@/insights/insights.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface TranscricaoBody {
  texto?: string;
  instrucoes?: string;
}

// Categoria da Memória onde as atas de reunião são guardadas.
const CATEGORIA_REUNIOES = 'reunioes';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class TranscricaoController {
  private readonly logger = new Logger(TranscricaoController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly insights: InsightsService,
  ) {}

  /**
   * POST /ai/transcricao (multipart) → gera uma ATA estratégica detalhada a
   * partir de uma transcrição (arquivo ou texto), SALVA na Memória (Reuniões) e
   * gera INSIGHTS a partir dela (página de Insights).
   * Retorna { titulo, ata, salvo, memoriaId, insightsGerados }.
   */
  @Post('transcricao')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async transcricao(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() arquivo: UploadedFileLike | undefined,
    @Body() body: TranscricaoBody,
  ): Promise<{
    titulo: string;
    ata: string;
    salvo: boolean;
    memoriaId?: string;
    insightsGerados: number;
  }> {
    let conteudo = (body.texto || '').trim();
    if (arquivo) {
      try {
        const txt = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
        if (txt) conteudo = txt;
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Não consegui ler o arquivo enviado.',
        );
      }
    }
    if (!conteudo) throw new BadRequestException('Cole a transcrição ou envie um arquivo.');

    // Títulos da Memória para os [[wikilinks]] resolverem.
    let titulosMemoria: string[] = [];
    try {
      titulosMemoria = (await this.memorias.list(user.empresaId))
        .filter((m) => m.active)
        .map((m) => m.title)
        .slice(0, 200);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos da memória: ${String(err)}`);
    }

    const userPrompt = buildTranscricaoUser(conteudo, (body.instrucoes || '').trim(), titulosMemoria);
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_TRANSCRICAO, userPrompt, 16000);
    const { titulo, ata } = parseAtaEstrategica(text);

    // Salva a ata na Memória (categoria Reuniões), como o beculture grava no vault.
    let salvo = false;
    let memoriaId: string | undefined;
    try {
      const item = await this.memorias.create(
        user.empresaId,
        { category: CATEGORIA_REUNIOES, title: titulo, content: ata, source: 'Transcrição' },
        false,
      );
      salvo = true;
      memoriaId = item.id;
    } catch (err) {
      this.logger.error(`Falha ao salvar a ata na Memória: ${String(err)}`);
    }

    // Gera e persiste os insights a partir da ata (não bloqueia em falha).
    const gerados = await this.insights.gerarDeMaterial(user.empresaId, user.id, {
      titulo,
      conteudo: ata,
      origem: 'Transcrição',
      memoriaId,
    });

    return { titulo, ata, salvo, memoriaId, insightsGerados: gerados.length };
  }
}
