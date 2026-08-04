import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMediaConnectionsService } from './media-connections.service';
import { gerarImagensOpenAI, type ModeloImagem } from './imagem/gerar';
import { designImagemHint, parseDesign, type DesignSystemDto } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface ImagemBody {
  prompt?: string;
  modelo?: string;
  size?: string;
  quality?: string;
  style?: string;
  background?: string;
  formato?: string;
  n?: number | string;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

function mensagemErro(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; error?: { message?: unknown }; status?: number };
    const raw =
      (typeof e.error?.message === 'string' && e.error.message) ||
      (typeof e.message === 'string' && e.message) ||
      '';
    if (e.status === 403 && /verif/i.test(raw)) {
      return 'Sua organização precisa ser verificada na OpenAI para usar o gpt-image-1 (platform.openai.com → Settings → Organization). Ou use o DALL·E 3.';
    }
    if (raw) return `OpenAI: ${raw}`;
  }
  return 'Não foi possível gerar a imagem. Tente novamente.';
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class ImagemController {
  private readonly logger = new Logger(ImagemController.name);

  constructor(
    private readonly media: AiMediaConnectionsService,
    private readonly config: ConfigService,
    private readonly memorias: MemoriasService,
  ) {}

  /**
   * POST /ai/imagem → gera imagens por IA (OpenAI). Usa EXCLUSIVAMENTE a conexão
   * de IA de Imagem do tenant (BYOK) ou, na sua ausência, a OPENAI_API_KEY
   * gerenciada. A conexão de Texto nunca é usada aqui. Retorna data URLs base64.
   */
  @Post('imagem')
  async imagem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImagemBody,
  ): Promise<{ images: string[]; formato: string }> {
    const prompt = (body.prompt || '').trim();
    if (!prompt) throw new BadRequestException('Descreva a imagem que você quer gerar.');
    // A marca escolhida no AI Studio entra como orientação de estilo. As
    // diretrizes do tenant entram em versão compacta: o modelo de imagem não
    // tem system prompt, então as regras precisam viajar no próprio prompt.
    let restricoes = '';
    try {
      restricoes = await this.memorias.blocoCompacto(user.empresaId);
    } catch (err) {
      this.logger.warn(`Falha ao carregar Diretrizes para a imagem: ${String(err)}`);
    }
    const promptFinal =
      prompt + designImagemHint(parseDesign(body.design)) + restricoes;

    // Resolve a chave a partir da conexão de Imagem. Hoje a geração é feita pela
    // OpenAI, então provedores de imagem que não sejam OpenAI ainda não têm
    // geração implementada — orienta o usuário em vez de falhar silenciosamente.
    const conn = await this.media.getDecrypted(user.empresaId, 'image');
    if (conn && conn.provider !== 'openai') {
      throw new BadRequestException(
        `A geração de imagem ainda só está disponível para a OpenAI. Conecte a OpenAI na aba Imagem (provedor atual: ${conn.provider}).`,
      );
    }
    let key = conn?.apiKey || '';
    if (!key) key = this.config.get<string>('OPENAI_API_KEY') || '';
    if (!key) {
      throw new BadRequestException(
        'Nenhuma IA de Imagem conectada. Conecte a OpenAI na aba Imagem em Conectores (ou defina OPENAI_API_KEY no servidor).',
      );
    }

    try {
      const { images, formato } = await gerarImagensOpenAI(key, {
        prompt: promptFinal,
        modelo: (body.modelo as ModeloImagem) || 'gpt-image-1',
        size: body.size,
        quality: body.quality,
        style: body.style,
        background: body.background,
        formato: body.formato,
        n: Number(body.n) || 1,
      });
      if (!images.length) throw new Error('A OpenAI não retornou nenhuma imagem.');
      const mime = formato === 'jpeg' ? 'image/jpeg' : formato === 'webp' ? 'image/webp' : 'image/png';
      return { images: images.map((b) => `data:${mime};base64,${b}`), formato };
    } catch (err) {
      throw new BadRequestException(mensagemErro(err));
    }
  }
}
