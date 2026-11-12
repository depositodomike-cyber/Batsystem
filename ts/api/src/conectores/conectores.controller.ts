import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConectoresService } from './conectores.service';
import { AcessoConectores } from './acesso-conectores';
import { SalvarCredenciaisDto } from './dto/credenciais.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Conectores (integrações) do usuário logado: as conexões da organização e
 * as PESSOAIS dele (Gmail, Outlook, Agenda, Drive) — nunca as de outro membro.
 *
 * Alterar exige permissão conforme o conector: a própria conta pessoal,
 * `conectores.visualizar`; um conector da organização, `conectores.configurar`.
 * Listar segue aberto a quem está logado, como antes.
 */
@Controller('conectores')
@UseGuards(JwtAuthGuard)
export class ConectoresController {
  constructor(
    private readonly conectores: ConectoresService,
    private readonly acesso: AcessoConectores,
  ) {}

  @Get('categorias')
  categories() {
    return this.conectores.categories();
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoria') categoria?: string,
  ) {
    return this.conectores.list(user.empresaId, user.id, { categoria });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.get(user.empresaId, user.id, id);
  }

  @Post(':id/conectar')
  async connect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.acesso.exigirPodeAlterar(user, id);
    return this.conectores.connect(user.empresaId, user.id, id, 'app');
  }

  /**
   * PUT /conectores/:id/credenciais → grava as credenciais de formulário e
   * ativa o conector (Teams, OneDrive, WhatsApp, YouTube, Zapier — todos da
   * organização). PUT, e não POST, porque substitui o conjunto inteiro.
   *
   * A resposta traz apenas os NOMES dos campos preenchidos: valor de credencial
   * nunca sai da API.
   */
  @Put(':id/credenciais')
  async salvarCredenciais(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SalvarCredenciaisDto,
  ) {
    await this.acesso.exigirPodeAlterar(user, id);
    return this.conectores.salvarCredenciais(user.empresaId, id, dto.campos);
  }

  @Delete(':id')
  async disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.acesso.exigirPodeAlterar(user, id);
    return this.conectores.disconnect(user.empresaId, user.id, id);
  }
}
