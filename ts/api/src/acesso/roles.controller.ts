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
import { TransferirPropriedadeDto } from './dto/transferir-propriedade.dto';
import { PermissoesGuard, RequerPermissao } from './permissoes.guard';
import { GRUPOS_PERMISSOES } from './permissoes.catalog';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { Roles, RolesGuard } from '@/common/roles.guard';
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
    const contexto = await this.roles.contextoDeAutorizacao(
      user.empresaId,
      user.id,
    );
    return {
      permissoes: contexto.permissoes,
      /**
       * Owner/admin da conta passam por cima das permissões (bypass legado) —
       * salvo se forem CONVIDADOS, e a condição tem de ser a mesma do
       * `PermissoesGuard`. Divergir aqui faria a tela anunciar um poder que a
       * API recusa, que é pior do que não anunciar nada.
       */
      administradorDaConta:
        !contexto.convidado &&
        (user.role === 'owner' || user.role === 'admin'),
    };
  }

  /**
   * POST /empresa/roles/owner/transferir → muda o proprietário da organização.
   *
   * Declarada ANTES das rotas com `:id` de propósito, mesma razão do
   * `catalogo` acima: um dia `:id/algo` casaria com `owner/transferir`.
   *
   * `RolesGuard` com `@Roles('owner')` — ESTRITO, e por isso NÃO o
   * `PermissoesGuard`: ele passa para `admin`, e aqui isso seria
   * auto-promoção. Não existe código de catálogo para propriedade da conta,
   * então nenhuma permissão serviria como gate. O `user.role` que o guard lê
   * vem do banco em toda requisição (ver `jwt.strategy`), não do claim do
   * token — é o que faz o rebaixamento valer na hora, sem invalidar sessão.
   *
   * O guard é a peneira grossa; a checagem que DECIDE está na transação do
   * service, com a linha travada.
   *
   * ESTA É A ÚNICA ROTA DA API QUE ESCREVE `Usuario.role` fora de
   * `CompaniesService.cadastrar()`.
   */
  @Post('owner/transferir')
  @UseGuards(RolesGuard)
  @Roles('owner')
  @HttpCode(200)
  transferirPropriedade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferirPropriedadeDto,
  ) {
    return this.roles.transferirPropriedade(user.empresaId, user.id, dto);
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
