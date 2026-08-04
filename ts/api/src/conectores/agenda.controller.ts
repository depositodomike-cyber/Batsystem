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
import { OauthProviderService } from './oauth-provider.service';
import { AgendaApiService, type AgendaEvento } from './agenda-api.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { oauthRetorno } from './oauth-retorno';

/**
 * Fluxo OAuth dos conectores de agenda (`google-calendar`). Rotas espelhadas
 * do EmailController — mesma mecânica, outro recurso:
 *
 * `GET /conectores/agenda/:provedor/autorizar` (JWT) → o front redireciona o
 * usuário para a `url` retornada (tela de consentimento do provedor).
 * `GET /conectores/agenda/:provedor/callback` (público — quem chama é o
 * navegador vindo do provedor) → troca o code pelos tokens e devolve o
 * usuário à página de Conectores.
 * `GET /conectores/agenda/:provedor/conta` (JWT) → confirma a conexão contra
 * a API do provedor (renovando o token se preciso) e devolve a conta.
 * `GET /conectores/agenda/:provedor/eventos` (JWT) → próximos eventos do
 * calendário principal, normalizados.
 */
@Controller('conectores/agenda/:provedor')
export class AgendaController {
  private readonly logger = new Logger(AgendaController.name);

  constructor(
    private readonly oauth: OauthProviderService,
    private readonly agendaApi: AgendaApiService,
  ) {}

  @Get('autorizar')
  @UseGuards(JwtAuthGuard)
  authorize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): { url: string } {
    return {
      url: this.oauth.buildAuthorizeUrl(user.empresaId, provedor, 'agenda'),
    };
  }

  @Get('conta')
  @UseGuards(JwtAuthGuard)
  async account(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): Promise<{ conta: string }> {
    return {
      conta: await this.oauth.checkAccount(user.empresaId, provedor, 'agenda'),
    };
  }

  /** Próximos eventos (padrão: 25, máx. 100). */
  @Get('eventos')
  @UseGuards(JwtAuthGuard)
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Query('limite') limite?: string,
  ): Promise<{ conta: string | null; eventos: AgendaEvento[] }> {
    const eventos = await this.agendaApi.listUpcoming(
      user.empresaId,
      provedor,
      Number(limite) || undefined,
    );
    return {
      conta: await this.contaSilenciosa(user.empresaId, provedor),
      eventos,
    };
  }

  /** Conta autorizada só para rotular a agenda — nunca derruba a listagem. */
  private async contaSilenciosa(
    empresaId: string,
    provedor: string,
  ): Promise<string | null> {
    try {
      return await this.oauth.checkAccount(empresaId, provedor, 'agenda');
    } catch {
      return null;
    }
  }

  @Get('callback')
  async callback(
    @Param('provedor') provedor: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const front = this.oauth.frontConectoresUrl;
    // Usuário negou na tela do provedor (ou o provedor reportou erro).
    if (error || !code || !state) {
      res.redirect(
        oauthRetorno(front, provedor, {
          motivo: error ?? 'autorizacao_cancelada',
        }),
      );
      return;
    }
    try {
      const conta = await this.oauth.handleCallback(code, state, 'agenda');
      res.redirect(oauthRetorno(front, provedor, { conta }));
    } catch (err) {
      this.logger.error(err);
      const motivo =
        err instanceof HttpException
          ? String(
              (err.getResponse() as { message?: string }).message ??
                err.message,
            )
          : 'Erro inesperado ao concluir a autorização.';
      res.redirect(oauthRetorno(front, provedor, { motivo }));
    }
  }
}
