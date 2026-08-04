import {
  Body,
  Controller,
  HttpException,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { ChatStreamDto } from './dto/chat.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { ConversasService } from '@/conversas/conversas.service';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly ai: AiService,
    private readonly conversas: ConversasService,
  ) {}

  /**
   * POST /ai/chat/stream → resposta do agente via SSE.
   * Eventos: {type:'meta',conversaId} · {type:'delta',text} · {type:'done',conversaId} · {type:'error',message}.
   *
   * Persiste a conversa: cria/continua a Conversa, grava o turno do usuário antes
   * de transmitir e o turno da IA ao final. Assim o histórico fica gravado mesmo
   * que o usuário saia da tela.
   */
  @Post('chat/stream')
  @UseGuards(JwtAuthGuard)
  async chatStream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatStreamDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Se o cliente desconectar, interrompemos o stream do provedor para não
    // continuar consumindo tokens (custo) com ninguém ouvindo.
    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
    });

    const send = (payload: unknown): void => {
      if (!clientGone) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    // Turno novo do usuário = última mensagem (o front sempre envia a pergunta
    // atual por último). Só persistimos quando há de fato uma pergunta nova.
    const last = dto.messages[dto.messages.length - 1];
    const novaPergunta =
      last && last.role === 'user' && last.text.trim() ? last.text : null;

    let conversaId: string | null = null;
    let full = '';

    try {
      if (novaPergunta) {
        const conversa = await this.conversas.ensureConversa({
          empresaId: user.empresaId,
          usuarioId: user.id,
          squadId: dto.squadId,
          agentId: dto.agentId,
          conversaId: dto.conversaId,
          tituloSeed: novaPergunta,
        });
        conversaId = conversa.id;
        await this.conversas.appendMessage(conversaId, 'user', novaPergunta);
        send({ type: 'meta', conversaId });
      }

      const stream = this.ai.chatStream({
        ...dto,
        empresaId: user.empresaId,
        usuarioId: user.id,
      });
      for await (const chunk of stream) {
        if (clientGone) break;
        full += chunk;
        send({ type: 'delta', text: chunk });
      }

      if (conversaId && full.trim()) {
        await this.conversas.appendMessage(conversaId, 'assistant', full);
      }
      send({ type: 'done', conversaId });
    } catch (err) {
      // Só mensagens de HttpException (intencionais) chegam ao cliente; erros
      // de SDK/provedor podem conter detalhes internos e são apenas logados.
      this.logger.error(err);
      const message =
        err instanceof HttpException
          ? String((err.getResponse() as { message?: string }).message ?? err.message)
          : 'Erro ao gerar resposta. Tente novamente.';
      send({ type: 'error', message });
    } finally {
      res.end();
    }
  }
}
