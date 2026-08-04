import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiMediaConnectionsService } from './media-connections.service';
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
  constructor(
    private readonly ai: AiService,
    private readonly media: AiMediaConnectionsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Chave HeyGen usada por "Criar Vídeo": conexão de IA de Vídeo do tenant
   * (BYOK) quando o provedor for HeyGen; senão, a HEYGEN_API_KEY do servidor.
   * Provedores de vídeo que não sejam HeyGen ainda não têm geração implementada.
   */
  private async key(empresaId: string): Promise<string> {
    const conn = await this.media.getDecrypted(empresaId, 'video');
    if (conn && conn.provider !== 'heygen') {
      throw new BadRequestException(
        `A geração de vídeo ainda só está disponível para o HeyGen. Conecte o HeyGen na aba Vídeo (provedor atual: ${conn.provider}).`,
      );
    }
    return conn?.apiKey || this.config.get<string>('HEYGEN_API_KEY') || '';
  }

  /** GET /ai/video/config → se há chave HeyGen (conexão do tenant ou servidor). */
  @Get('config')
  async config_(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ configurado: boolean }> {
    return { configurado: !!(await this.key(user.empresaId)) };
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
    try {
      return { avatares: await heygen.avatares(await this.key(user.empresaId)) };
    } catch (err) {
      throw new BadRequestException(erroMsg(err));
    }
  }

  /** GET /ai/video/vozes → vozes da conta HeyGen (pt-BR no topo). */
  @Get('vozes')
  async vozes(@CurrentUser() user: AuthenticatedUser) {
    try {
      return { vozes: await heygen.vozes(await this.key(user.empresaId)) };
    } catch (err) {
      throw new BadRequestException(erroMsg(err));
    }
  }

  /** POST /ai/video/gerar → dispara a geração; devolve { videoId, teste }. */
  @Post('gerar')
  async gerar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GerarBody,
  ) {
    try {
      return await heygen.gerar(await this.key(user.empresaId), {
        script: body.script || '',
        avatarId: body.avatarId || '',
        voiceId: body.voiceId || '',
        formato: body.formato,
        speed: body.speed,
        fundo: body.fundo,
        titulo: body.titulo,
        teste: body.teste,
      });
    } catch (err) {
      throw new BadRequestException(erroMsg(err));
    }
  }

  /** GET /ai/video/status?videoId= → status do vídeo (polling). */
  @Get('status')
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Query('videoId') videoId: string,
  ) {
    try {
      return await heygen.status(await this.key(user.empresaId), videoId || '');
    } catch (err) {
      throw new BadRequestException(erroMsg(err));
    }
  }
}
