import {
  Controller,
  Get,
  HttpException,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { OauthProviderService } from './oauth-provider.service';
import {
  DriveApiService,
  type DriveArquivo,
  type DriveArquivoNaArvore,
} from './drive-api.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { oauthRetorno } from './oauth-retorno';

/**
 * Google Drive (somente leitura). Mesmas rotas OAuth do AgendaController,
 * mais a leitura de arquivos para a importação ao Repositório:
 *
 * `GET /conectores/drive/:provedor/autorizar` (JWT) → URL de consentimento.
 * `GET /conectores/drive/:provedor/callback` (público, valida o `state`).
 * `GET /conectores/drive/:provedor/conta` (JWT) → confirma a conta.
 * `GET /conectores/drive/:provedor/arquivos?pasta=&q=&pagina=` (JWT) → conteúdo de
 *   uma pasta ("root", "compartilhados" ou id) ou busca em todo o Drive.
 * `GET /conectores/drive/:provedor/pastas/:id` (JWT) → pasta e caminho (breadcrumb).
 * `GET /conectores/drive/:provedor/pastas/:id/arvore` (JWT) → arquivos da pasta,
 *   recursivamente, com o caminho relativo (importar a pasta inteira).
 * `GET /conectores/drive/:provedor/arquivos/:id/conteudo` (JWT) → texto.
 */
@Controller('conectores/drive/:provedor')
export class DriveController {
  private readonly logger = new Logger(DriveController.name);

  constructor(
    private readonly oauth: OauthProviderService,
    private readonly drive: DriveApiService,
  ) {}

  @Get('autorizar')
  @UseGuards(JwtAuthGuard)
  authorize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): { url: string } {
    return { url: this.oauth.buildAuthorizeUrl(user.empresaId, provedor, 'drive') };
  }

  @Get('conta')
  @UseGuards(JwtAuthGuard)
  async account(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): Promise<{ conta: string }> {
    return { conta: await this.oauth.checkAccount(user.empresaId, provedor, 'drive') };
  }

  @Get('arquivos')
  @UseGuards(JwtAuthGuard)
  arquivos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Query('pasta') pasta?: string,
    @Query('q') q?: string,
    @Query('pagina') pagina?: string,
  ): Promise<{ arquivos: DriveArquivo[]; proximaPagina: string | null }> {
    this.exigirDrive(provedor);
    return this.drive.listar(user.empresaId, { pasta, busca: q, pageToken: pagina });
  }

  @Get('pastas/:id')
  @UseGuards(JwtAuthGuard)
  pasta(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Param('id') id: string,
  ) {
    this.exigirDrive(provedor);
    return this.drive.pasta(user.empresaId, id);
  }

  @Get('pastas/:id/arvore')
  @UseGuards(JwtAuthGuard)
  arvore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Param('id') id: string,
  ): Promise<{ pasta: { id: string; nome: string }; arquivos: DriveArquivoNaArvore[]; truncado: boolean }> {
    this.exigirDrive(provedor);
    return this.drive.arvore(user.empresaId, id);
  }

  @Get('arquivos/:id/conteudo')
  @UseGuards(JwtAuthGuard)
  conteudo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Param('id') id: string,
  ) {
    this.exigirDrive(provedor);
    return this.drive.conteudo(user.empresaId, id);
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
    if (error || !code || !state) {
      res.redirect(oauthRetorno(front, provedor, { motivo: error ?? 'autorizacao_cancelada' }));
      return;
    }
    try {
      const conta = await this.oauth.handleCallback(code, state, 'drive');
      res.redirect(oauthRetorno(front, provedor, { conta }));
    } catch (err) {
      this.logger.error(err);
      const motivo =
        err instanceof HttpException
          ? String((err.getResponse() as { message?: string }).message ?? err.message)
          : 'Erro inesperado ao concluir a autorização.';
      res.redirect(oauthRetorno(front, provedor, { motivo }));
    }
  }

  private exigirDrive(provedor: string) {
    if (provedor !== 'google-drive') {
      throw new NotFoundException(`Provedor "${provedor}" não suportado nesta rota.`);
    }
  }
}
