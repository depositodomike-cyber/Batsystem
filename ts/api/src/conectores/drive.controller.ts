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
import { AcessoConectores } from './acesso-conectores';
import { enviarRetornoOauth, oauthRetorno, origemOauth } from './oauth-retorno';

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
    private readonly acesso: AcessoConectores,
  ) {}

  @Get('autorizar')
  @UseGuards(JwtAuthGuard)
  async authorize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Query('origem') origem?: string,
  ): Promise<{ url: string }> {
    await this.acesso.exigirPodeAlterar(user, provedor);
    return { url: this.oauth.buildAuthorizeUrl(
        user.empresaId,
        user.id,
        provedor,
        'drive',
        origemOauth(origem),
      ) };
  }

  @Get('conta')
  @UseGuards(JwtAuthGuard)
  async account(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
  ): Promise<{ conta: string }> {
    return { conta: await this.oauth.checkAccount(user.empresaId, user.id, provedor, 'drive') };
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
    return this.drive.listar(user.empresaId, user.id, { pasta, busca: q, pageToken: pagina });
  }

  @Get('pastas/:id')
  @UseGuards(JwtAuthGuard)
  pasta(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Param('id') id: string,
  ) {
    this.exigirDrive(provedor);
    return this.drive.pasta(user.empresaId, user.id, id);
  }

  @Get('pastas/:id/arvore')
  @UseGuards(JwtAuthGuard)
  arvore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Param('id') id: string,
  ): Promise<{ pasta: { id: string; nome: string }; arquivos: DriveArquivoNaArvore[]; truncado: boolean }> {
    this.exigirDrive(provedor);
    return this.drive.arvore(user.empresaId, user.id, id);
  }

  @Get('arquivos/:id/conteudo')
  @UseGuards(JwtAuthGuard)
  conteudo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provedor') provedor: string,
    @Param('id') id: string,
  ) {
    this.exigirDrive(provedor);
    return this.drive.conteudo(user.empresaId, user.id, id);
  }

  @Get('callback')
  async callback(
    @Param('provedor') provedor: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const front = this.oauth.frontRetorno(state);
    if (error || !code || !state) {
      enviarRetornoOauth(res, oauthRetorno(front, provedor, { motivo: error ?? 'autorizacao_cancelada' }));
      return;
    }
    try {
      const conta = await this.oauth.handleCallback(code, state, 'drive');
      enviarRetornoOauth(res, oauthRetorno(front, provedor, { conta }));
    } catch (err) {
      this.logger.error(err);
      const motivo =
        err instanceof HttpException
          ? String((err.getResponse() as { message?: string }).message ?? err.message)
          : 'Erro inesperado ao concluir a autorização.';
      enviarRetornoOauth(res, oauthRetorno(front, provedor, { motivo }));
    }
  }

  private exigirDrive(provedor: string) {
    if (provedor !== 'google-drive') {
      throw new NotFoundException(`Provedor "${provedor}" não suportado nesta rota.`);
    }
  }
}
