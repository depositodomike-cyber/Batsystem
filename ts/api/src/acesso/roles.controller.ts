import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CriarRoleDto } from './dto/criar-role.dto';
import { AtualizarRoleDto } from './dto/atualizar-role.dto';
import { ExcluirRoleQuery } from './dto/excluir-role.query';
import { PermissoesGuard, RequerPermissao } from './permissoes.guard';
import { GRUPOS_PERMISSOES } from './permissoes.catalog';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Roles e permissões — aba Acesso da tela de Administração.
 *
 * Sob `/empresa/...` para acompanhar `/empresa/membros` e `/empresa/convites`.
 * Leitura liberada a todo mundo do tenant (mesma decisão das outras rotas de
 * `/empresa`); escrita exige `acesso.gerenciar`, com o bypass de owner/admin
 * descrito no PermissoesGuard.
 */
@Controller('empresa/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /**
   * GET /empresa/roles/catalogo → grupos e permissões disponíveis.
   *
   * Antes de `:id` de propósito: "catalogo" casaria com a rota de detalhe.
   */
  @Get('catalogo')
  catalogo() {
    return { grupos: GRUPOS_PERMISSOES };
  }

  /** GET /empresa/roles/minhas-permissoes → o que o usuário logado pode fazer. */
  @Get('minhas-permissoes')
  async minhasPermissoes(@CurrentUser() user: AuthenticatedUser) {
    return {
      permissoes: await this.roles.permissoesDoUsuario(user.empresaId, user.id),
      /** Owner/admin da conta passam por cima das permissões (bypass legado). */
      administradorDaConta: user.role === 'owner' || user.role === 'admin',
    };
  }

  /** GET /empresa/roles → roles do tenant, com contagem de membros. */
  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.listar(user.empresaId);
  }

  /** GET /empresa/roles/:id */
  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roles.obter(user.empresaId, id);
  }

  /** POST /empresa/roles → cria role personalizada. */
  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('acesso.gerenciar')
  criar(@CurrentUser() user: AuthenticatedUser, @Body() dto: CriarRoleDto) {
    return this.roles.criar(user.empresaId, dto);
  }

  /** PATCH /empresa/roles/:id → edita nome/descrição/permissões. */
  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('acesso.gerenciar')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarRoleDto,
  ) {
    return this.roles.atualizar(user.empresaId, id, dto);
  }

  /**
   * DELETE /empresa/roles/:id?reatribuirPara=<roleId|nenhuma>
   *
   * Recusa com 409 se houver membros e `reatribuirPara` não vier.
   */
  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('acesso.gerenciar')
  @HttpCode(204)
  remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ExcluirRoleQuery,
  ) {
    return this.roles.remover(user.empresaId, id, query);
  }
}
