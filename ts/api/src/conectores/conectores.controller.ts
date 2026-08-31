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
import { SalvarCredenciaisDto } from './dto/credenciais.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Conectores (integrações) da empresa do usuário logado.
 * Mesmo estado consumido pelas ferramentas do servidor MCP (/mcp).
 */
@Controller('conectores')
@UseGuards(JwtAuthGuard)
export class ConectoresController {
  constructor(private readonly conectores: ConectoresService) {}

  @Get('categorias')
  categories() {
    return this.conectores.categories();
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoria') categoria?: string,
  ) {
    return this.conectores.list(user.empresaId, { categoria });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.get(user.empresaId, id);
  }

  @Post(':id/conectar')
  connect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.connect(user.empresaId, id, 'app');
  }

  /**
   * PUT /conectores/:id/credenciais → grava as credenciais de formulário e
   * ativa o conector (Google Drive, Teams, OneDrive, WhatsApp, YouTube,
   * Zapier). PUT, e não POST, porque substitui o conjunto inteiro de campos.
   *
   * A resposta traz apenas os NOMES dos campos preenchidos: valor de credencial
   * nunca sai da API.
   */
  @Put(':id/credenciais')
  salvarCredenciais(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SalvarCredenciaisDto,
  ) {
    return this.conectores.salvarCredenciais(user.empresaId, id, dto.campos);
  }

  @Delete(':id')
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.disconnect(user.empresaId, id);
  }
}
