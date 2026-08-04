import {
  Controller,
  Get,
  HttpException,
  Logger,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SlackOauthService } from './slack-oauth.service';
import {
  SlackApiService,
  type SlackConversaItem,
  type SlackMensagemItem,
} from './slack-api.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { oauthRetorno } from './oauth-retorno';

/**
 * Fluxo OAuth e leitura do conector Slack.
 *
 * `GET /conectores/slack/autorizar` (JWT) → o front redireciona o usuário
 * para a `url` retornada (tela de consentimento do Slack).
 * `GET /conectores/slack/callback` (público — quem chama é o navegador
 * vindo do Slack) → troca o code por token e devolve o usuário ao app.
 * `GET /conectores/slack/conversas` (JWT) → canais, conversas em grupo e DMs
 * da conta que autorizou (é o que a página de Slack lista na coluna da
 * esquerda). A leitura usa o token dessa pessoa, não o de bot — ver
 * SlackApiService.
 * `GET /conectores/slack/conversas/:canalId/mensagens` (JWT) → mensagens da
 * conversa, com as respostas de cada thread.
 */
@Controller('conectores/slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly slackOauth: SlackOauthService,
    private readonly slackApi: SlackApiService,
  ) {}

  @Get('autorizar')
  @UseGuards(JwtAuthGuard)
  authorize(@CurrentUser() user: AuthenticatedUser): { url: string } {
    return { url: this.slackOauth.buildAuthorizeUrl(user.empresaId) };
  }

  /**
   * As conversas da conta autorizada, com o nome dela — a tela mostra de quem
   * é o Slack que está sendo lido ali.
   */
  @Get('conversas')
  @UseGuards(JwtAuthGuard)
  async conversas(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ conversas: SlackConversaItem[]; conta: string | null }> {
    const [conversas, conta] = await Promise.all([
      this.slackApi.listConversas(user.empresaId),
      this.slackApi.nomeDaConta(user.empresaId),
    ]);
    return { conversas, conta };
  }

  /** Mensagens da conversa (padrão: 50, máx. 100), com threads. */
  @Get('conversas/:canalId/mensagens')
  @UseGuards(JwtAuthGuard)
  async mensagens(
    @CurrentUser() user: AuthenticatedUser,
    @Param('canalId') canalId: string,
    @Query('limite') limite?: string,
  ): Promise<{ mensagens: SlackMensagemItem[] }> {
    const mensagens = await this.slackApi.listMensagens(
      user.empresaId,
      canalId,
      Number(limite) || undefined,
    );
    return { mensagens };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const front = this.slackOauth.frontConectoresUrl;
    // Usuário negou na tela do Slack (ou o Slack reportou erro).
    if (error || !code || !state) {
      res.redirect(
        oauthRetorno(front, 'slack', {
          motivo: error ?? 'autorizacao_cancelada',
        }),
      );
      return;
    }
    try {
      const workspace = await this.slackOauth.handleCallback(code, state);
      res.redirect(oauthRetorno(front, 'slack', { conta: workspace }));
    } catch (err) {
      this.logger.error(err);
      const motivo =
        err instanceof HttpException
          ? String(
              (err.getResponse() as { message?: string }).message ?? err.message,
            )
          : 'Erro inesperado ao concluir a autorização.';
      res.redirect(oauthRetorno(front, 'slack', { motivo }));
    }
  }
}
