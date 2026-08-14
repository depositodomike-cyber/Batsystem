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
import { ehChaveRejeitada, ehFalhaDeProvedor } from './falha-provedor';
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
   * POST /ai/imagem → gera imagens por IA (OpenAI). Usa EXCLUSIVAMENTE a fila de
   * conexões de IA de Imagem do tenant (BYOK), na ordem de prioridade definida
   * em Configurações, ou, na ausência dela, a OPENAI_API_KEY gerenciada. A
   * conexão de Texto nunca é usada aqui. Retorna data URLs base64.
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

    const tentativas = await this.tentativas(user.empresaId);

    // Tenta os modelos da fila em ordem: se um cair, o próximo assume. O modelo
    // escolhido no AI Studio (body.modelo) vale para a primeira tentativa; nas
    // seguintes usamos o modelo configurado em cada conexão de reserva.
    let ultimoErro: unknown;
    for (let i = 0; i < tentativas.length; i++) {
      const tentativa = tentativas[i];
      const escolhido = (body.modelo as ModeloImagem) || undefined;
      const reserva = tentativa.model as ModeloImagem | undefined;
      try {
        const { images, formato } = await gerarImagensOpenAI(tentativa.apiKey, {
          prompt: promptFinal,
          modelo: (i === 0 ? escolhido || reserva : reserva || escolhido) || 'gpt-image-1',
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
        ultimoErro = err;
        const tentarProximo = ehFalhaDeProvedor(err) && i < tentativas.length - 1;
        this.logger.warn(
          `Falha ao gerar imagem com ${tentativa.model ?? 'chave gerenciada'}: ${String(err)}` +
            (tentarProximo ? ' — tentando o próximo modelo da fila.' : ''),
        );
        if (tentativa.id && ehChaveRejeitada(err)) {
          void this.media.marcarInvalida(tentativa.id);
        }
        if (!tentarProximo) break;
      }
    }

    throw new BadRequestException(mensagemErro(ultimoErro));
  }

  /**
   * Fila de tentativas para a geração: as conexões de Imagem do tenant em ordem
   * de prioridade e, na ausência delas, a chave gerenciada do servidor. Hoje a
   * geração é feita pela OpenAI, então provedores sem implementação são
   * descartados — e se a fila TODA for de outros provedores, orienta o usuário
   * em vez de falhar silenciosamente.
   */
  private async tentativas(
    empresaId: string,
  ): Promise<{ id?: string; model?: string; apiKey: string }[]> {
    const fila = await this.media.listDecrypted(empresaId, 'image');
    const suportadas = fila.filter((c) => c.provider === 'openai');
    if (suportadas.length > 0) return suportadas;

    if (fila.length > 0) {
      const provedores = [...new Set(fila.map((c) => c.provider))].join(', ');
      throw new BadRequestException(
        `A geração de imagem ainda só está disponível para a OpenAI. Adicione um modelo da OpenAI na seção Imagem (provedores atuais: ${provedores}).`,
      );
    }

    const key = this.config.get<string>('OPENAI_API_KEY') || '';
    if (!key) {
      throw new BadRequestException(
        'Nenhuma IA de Imagem conectada. Conecte a OpenAI na seção Imagem em Configurações (ou defina OPENAI_API_KEY no servidor).',
      );
    }
    return [{ apiKey: key }];
  }
}
