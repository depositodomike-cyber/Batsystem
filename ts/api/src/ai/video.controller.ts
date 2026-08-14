import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiMediaConnectionsService } from './media-connections.service';
import { ehChaveRejeitada, ehFalhaDeProvedor } from './falha-provedor';
import * as heygen from './video/heygen';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const SYSTEM_ROTEIRO_VIDEO = `Você escreve ROTEIROS DE NARRAÇÃO para vídeos curtos de avatar falante, em português do Brasil.
A partir de um tema (e contexto opcional), escreva APENAS o texto que o avatar vai falar — natural, direto, como fala de gente, na 2ª pessoa ("você").
- Comece por um gancho de 1 frase. Desenvolva com clareza. Termine com um CTA único.
- Sem marcações de cena, sem "[música]", sem emojis, sem título — só o texto falado corrido.
- Duração-alvo: ~45–75 segundos de fala (cerca de 110–170 palavras), salvo se o contexto pedir outra.
- PROIBIDO clichê de IA ("no mundo de hoje", "descubra como", "revolucionar"). Não invente dados.`;

interface RoteiroBody {
  tema?: string;
  contexto?: string;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}
interface GerarBody {
  script?: string;
  avatarId?: string;
  voiceId?: string;
  formato?: string;
  speed?: number;
  fundo?: string;
  titulo?: string;
  teste?: boolean;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

function erroMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Falha na chamada ao HeyGen.';
}

@Controller('ai/video')
@UseGuards(JwtAuthGuard)
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly ai: AiService,
    private readonly media: AiMediaConnectionsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Chaves HeyGen usadas por "Criar Vídeo", em ordem de prioridade: a fila de
   * conexões de IA de Vídeo do tenant (BYOK) filtrada pelos provedores com
   * geração implementada (hoje só HeyGen); na ausência de qualquer conexão, a
   * HEYGEN_API_KEY do servidor. `outrosProvedores` serve só para a mensagem de
   * erro quando a fila existe mas nenhum item é suportado.
   */
  private async filaHeygen(empresaId: string): Promise<{
    chaves: { id?: string; apiKey: string }[];
    outrosProvedores: string[];
  }> {
    const fila = await this.media.listDecrypted(empresaId, 'video');
    const suportadas = fila.filter((c) => c.provider === 'heygen');
    if (suportadas.length > 0) {
      return { chaves: suportadas, outrosProvedores: [] };
    }
    if (fila.length > 0) {
      return {
        chaves: [],
        outrosProvedores: [...new Set(fila.map((c) => c.provider))],
      };
    }
    const key = this.config.get<string>('HEYGEN_API_KEY') || '';
    return { chaves: key ? [{ apiKey: key }] : [], outrosProvedores: [] };
  }

  /**
   * Executa a chamada ao HeyGen na primeira chave da fila e, se ela falhar por
   * culpa do provedor, tenta a próxima. Vale para todas as rotas: `gerar` só
   * cria o vídeo quando a chamada dá certo, e `status`/`avatares`/`vozes` são
   * leituras — a conta que responde é a mesma que atendeu a geração.
   */
  private async comFailover<T>(
    empresaId: string,
    executar: (apiKey: string) => Promise<T>,
  ): Promise<T> {
    const { chaves, outrosProvedores } = await this.filaHeygen(empresaId);
    if (chaves.length === 0) {
      throw new BadRequestException(
        outrosProvedores.length > 0
          ? `A geração de vídeo ainda só está disponível para o HeyGen. Adicione um modelo do HeyGen na seção Vídeo (provedores atuais: ${outrosProvedores.join(', ')}).`
          : 'Nenhuma IA de Vídeo conectada. Conecte o HeyGen na seção Vídeo em Configurações (ou defina HEYGEN_API_KEY no servidor).',
      );
    }

    let ultimoErro: unknown;
    for (let i = 0; i < chaves.length; i++) {
      try {
        return await executar(chaves[i].apiKey);
      } catch (err) {
        ultimoErro = err;
        const tentarProximo = ehFalhaDeProvedor(err) && i < chaves.length - 1;
        this.logger.warn(
          `Falha na chamada ao HeyGen: ${String(err)}` +
            (tentarProximo ? ' — tentando a próxima chave da fila.' : ''),
        );
        if (chaves[i].id && ehChaveRejeitada(err)) {
          void this.media.marcarInvalida(chaves[i].id!);
        }
        if (!tentarProximo) break;
      }
    }
    throw new BadRequestException(erroMsg(ultimoErro));
  }

  /** GET /ai/video/config → se há chave HeyGen (conexão do tenant ou servidor). */
  @Get('config')
  async config_(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ configurado: boolean }> {
    const { chaves } = await this.filaHeygen(user.empresaId);
    return { configurado: chaves.length > 0 };
  }

  /** POST /ai/video/roteiro → gera o texto falado a partir de um tema (via IA). */
  @Post('roteiro')
  async roteiro(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RoteiroBody,
  ): Promise<{ script: string }> {
    const tema = (body.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o assunto do vídeo.');
    const contexto = (body.contexto || '').trim();
    const userPrompt =
      designBrief(parseDesign(body.design)) +
      `## TEMA\n${tema}\n` +
      (contexto ? `\n## CONTEXTO\n${contexto}\n` : '') +
      `\nEscreva agora o texto falado (apenas o texto).`;
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_ROTEIRO_VIDEO, userPrompt, 1500);
    return { script: text.trim() };
  }

  /** GET /ai/video/avatares → avatares da conta HeyGen. */
  @Get('avatares')
  async avatares(@CurrentUser() user: AuthenticatedUser) {
    return this.comFailover(user.empresaId, async (apiKey) => ({
      avatares: await heygen.avatares(apiKey),
    }));
  }

  /** GET /ai/video/vozes → vozes da conta HeyGen (pt-BR no topo). */
  @Get('vozes')
  async vozes(@CurrentUser() user: AuthenticatedUser) {
    return this.comFailover(user.empresaId, async (apiKey) => ({
      vozes: await heygen.vozes(apiKey),
    }));
  }

  /** POST /ai/video/gerar → dispara a geração; devolve { videoId, teste }. */
  @Post('gerar')
  async gerar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GerarBody,
  ) {
    return this.comFailover(user.empresaId, (apiKey) =>
      heygen.gerar(apiKey, {
        script: body.script || '',
        avatarId: body.avatarId || '',
        voiceId: body.voiceId || '',
        formato: body.formato,
        speed: body.speed,
        fundo: body.fundo,
        titulo: body.titulo,
        teste: body.teste,
      }),
    );
  }

  /** GET /ai/video/status?videoId= → status do vídeo (polling). */
  @Get('status')
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Query('videoId') videoId: string,
  ) {
    return this.comFailover(user.empresaId, (apiKey) =>
      heygen.status(apiKey, videoId || ''),
    );
  }
}
