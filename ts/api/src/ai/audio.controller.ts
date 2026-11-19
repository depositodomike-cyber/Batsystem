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
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { ChaveOpenAiService } from './audio/chave-openai';
import { transcreverAudioOpenAI } from './audio/transcrever';
import {
  buildResumoAudioUser,
  parseResumoAudio,
  SYSTEM_RESUMO_AUDIO,
} from './transcricao/prompts';
import { MemoriasService } from '@/memorias/memorias.service';
import { InsightsService } from '@/insights/insights.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

const CATEGORIA_REUNIOES = 'reunioes';

@Controller('ai')
// Usar a IA exige `ia.usar` (todas as roles de sistema a têm).
@UseGuards(JwtAuthGuard, PermissoesGuard)
@RequerPermissao('ia.usar')
export class AudioController {
  private readonly logger = new Logger(AudioController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly insights: InsightsService,
    private readonly chaveOpenAi: ChaveOpenAiService,
  ) {}

  /**
   * Resolve uma chave OpenAI a partir de QUALQUER conexão do tenant. A
   * transcrição (Whisper) só existe na OpenAI, mas a chave pode ter sido salva
   * em qualquer modalidade — ver ChaveOpenAiService.
   */
  private resolveOpenAiKey(empresaId: string): Promise<string> {
    return this.chaveOpenAi.resolver(empresaId);
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

  /**
   * POST /ai/audio/transcrever (multipart 'audio', campo opcional 'idioma')
   * → { texto }. SÓ transcreve: não resume, não salva e não gera insights.
   *
   * É o ditado por voz do Oracle Desktop: o reconhecimento de fala do
   * navegador (Web Speech) não existe no Electron, então o app grava o trecho
   * falado e o transcreve aqui, com a mesma chave OpenAI de /ai/audio.
   */
  @Post('audio/transcrever')
  // Ditado custa transcrição paga: limite próprio, abaixo do global (GD-13).
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async transcrever(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() audio: UploadedFileLike | undefined,
    @Body('idioma') idioma?: string,
  ): Promise<{ texto: string }> {
    if (!audio || audio.size === 0) throw new BadRequestException('Envie o áudio gravado.');
    const key = await this.resolveOpenAiKey(user.empresaId);
    if (!key) {
      throw new BadRequestException(
        'O ditado usa a transcrição da OpenAI. Conecte a OpenAI em Conexões (Texto, Imagem ou Vídeo) ou defina OPENAI_API_KEY no servidor.',
      );
    }
    const lingua = idioma === 'en' || idioma === 'pt' ? idioma : undefined;
    try {
      const texto = await transcreverAudioOpenAI(
        key,
        audio.buffer,
        audio.originalname || 'ditado.webm',
        lingua,
      );
      return { texto };
    } catch (err) {
      // A mensagem do provedor pode citar parte da chave: fica só no log (GD-13).
      this.logger.warn(`Falha na transcrição do ditado: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('Não foi possível transcrever o áudio. Tente de novo em instantes.');
    }
  }
}
