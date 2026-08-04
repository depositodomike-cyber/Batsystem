import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiConnectionsService } from './connections.service';
import { AiMediaConnectionsService } from './media-connections.service';
import { transcreverAudioOpenAI } from './audio/transcrever';
import {
  buildResumoAudioUser,
  parseResumoAudio,
  SYSTEM_RESUMO_AUDIO,
} from './transcricao/prompts';
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

const CATEGORIA_REUNIOES = 'reunioes';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AudioController {
  private readonly logger = new Logger(AudioController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly insights: InsightsService,
    private readonly connections: AiConnectionsService,
    private readonly media: AiMediaConnectionsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Resolve uma chave OpenAI a partir de QUALQUER conexão do tenant. A
   * transcrição (Whisper) só existe na OpenAI, mas a chave pode ter sido salva
   * na conexão de Texto, de Imagem ou de Vídeo — usamos a primeira que for
   * OpenAI. Sem nenhuma, cai na OPENAI_API_KEY gerenciada do servidor.
   */
  private async resolveOpenAiKey(empresaId: string): Promise<string> {
    const texto = await this.connections.getDecrypted(empresaId);
    if (texto && texto.provider === 'openai' && texto.apiKey) return texto.apiKey;

    for (const kind of ['image', 'video'] as const) {
      const conn = await this.media.getDecrypted(empresaId, kind);
      if (conn && conn.provider === 'openai' && conn.apiKey) return conn.apiKey;
    }

    return this.config.get<string>('OPENAI_API_KEY') || '';
  }

  /**
   * POST /ai/audio (multipart 'audio') → transcreve o áudio (OpenAI Whisper) e
   * gera um RESUMO (terminando com as conexões Obsidian [[wikilinks]]), salvo na
   * Memória (Reuniões). Em seguida, gera INSIGHTS a partir do resumo (página de
   * Insights). Retorna { titulo, resumo, transcricao, salvo, memoriaId, insightsGerados }.
   */
  @Post('audio')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() audio: UploadedFileLike | undefined,
  ): Promise<{
    titulo: string;
    resumo: string;
    transcricao: string;
    salvo: boolean;
    memoriaId?: string;
    insightsGerados: number;
  }> {
    if (!audio) throw new BadRequestException('Envie um arquivo de áudio ou vídeo.');

    // Chave OpenAI para o STT — aceita a conexão de Texto, Imagem ou Vídeo que
    // for OpenAI, ou a chave gerenciada do servidor.
    const key = await this.resolveOpenAiKey(user.empresaId);
    if (!key) {
      throw new BadRequestException(
        'A transcrição de áudio usa a OpenAI. Conecte a OpenAI em Conexões (Texto, Imagem ou Vídeo) ou defina OPENAI_API_KEY no servidor.',
      );
    }

    let transcricao: string;
    try {
      transcricao = await transcreverAudioOpenAI(key, audio.buffer, audio.originalname);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? `Falha na transcrição: ${err.message}` : 'Falha ao transcrever o áudio.',
      );
    }
    if (!transcricao) throw new BadRequestException('Não consegui extrair fala do áudio.');

    // Títulos da Memória para os [[wikilinks]].
    let titulosMemoria: string[] = [];
    try {
      titulosMemoria = (await this.memorias.list(user.empresaId))
        .filter((m) => m.active)
        .map((m) => m.title)
        .slice(0, 200);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos da memória: ${String(err)}`);
    }

    const userPrompt = buildResumoAudioUser(transcricao, titulosMemoria);
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_RESUMO_AUDIO, userPrompt, 16000);
    const { titulo, resumo } = parseResumoAudio(text);

    let salvo = false;
    let memoriaId: string | undefined;
    try {
      const item = await this.memorias.create(
        user.empresaId,
        { category: CATEGORIA_REUNIOES, title: titulo, content: resumo, source: 'Áudio' },
        false,
      );
      salvo = true;
      memoriaId = item.id;
    } catch (err) {
      this.logger.error(`Falha ao salvar o resumo na Memória: ${String(err)}`);
    }

    // Gera e persiste os insights a partir do resumo (não bloqueia em falha).
    const gerados = await this.insights.gerarDeMaterial(user.empresaId, user.id, {
      titulo,
      conteudo: resumo,
      origem: 'Áudio',
      memoriaId,
    });

    return { titulo, resumo, transcricao, salvo, memoriaId, insightsGerados: gerados.length };
  }
}
