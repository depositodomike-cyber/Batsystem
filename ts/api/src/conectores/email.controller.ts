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
import { EmailApiService, type EmailItem } from './email-api.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { oauthRetorno } from './oauth-retorno';

/**
 * Fluxo OAuth dos conectores de e-mail (`gmail`, `outlook`).
 *
 * `GET /conectores/email/:provedor/autorizar` (JWT) → o front redireciona o
 * usuário para a `url` retornada (tela de consentimento do provedor).
 * `GET /conectores/email/:provedor/callback` (público — quem chama é o
 * navegador vindo do provedor) → troca o code pelos tokens e devolve o
 * usuário à página de Conectores.
 * `GET /conectores/email/:provedor/conta` (JWT) → confirma a conexão contra
 * a API do provedor (renovando o token se preciso) e devolve a conta.
 * `GET /conectores/email/:provedor/mensagens` (JWT) → caixa de entrada real
 * do tenant, normalizada (é o que a página de E-mail lista).
 */
@Controller('conectores/email/:provedor')
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(
    private readonly emailOauth: OauthProviderService,
    private readonly emailApi: EmailApiService,
  ) {}

  @Get('autorizar')
  @UseGuards(JwtAuthGuard)
  authorize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): { url: string } {
    return {
      url: this.emailOauth.buildAuthorizeUrl(user.empresaId, provedor, 'email'),
    };
  }

  @Get('conta')
  @UseGuards(JwtAuthGuard)
  async account(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): Promise<{ conta: string }> {
    return {
      conta: await this.emailOauth.checkAccount(
        user.empresaId,
        provedor,
        'email',
      ),
    };
  }

  /** Caixa de entrada da conta autorizada (padrão: 25 mensagens, máx. 50). */
  @Get('mensagens')
  @UseGuards(JwtAuthGuard)
  async messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Query('limite') limite?: string,
  ): Promise<{ conta: string | null; emails: EmailItem[] }> {
    const emails = await this.emailApi.listInbox(
      user.empresaId,
      provedor,
      Number(limite) || undefined,
    );
    return {
      conta: await this.contaSilenciosa(user.empresaId, provedor),
      emails,
    };
  }

  /** Conta autorizada só para rotular a caixa — nunca derruba a listagem. */
  private async contaSilenciosa(
    empresaId: string,
    provedor: string,
  ): Promise<string | null> {
    try {
      return await this.emailOauth.checkAccount(empresaId, provedor, 'email');
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
    const front = this.emailOauth.frontConectoresUrl;
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
      const conta = await this.emailOauth.handleCallback(code, state, 'email');
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
