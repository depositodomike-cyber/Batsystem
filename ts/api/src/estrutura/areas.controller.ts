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
import { AreasService } from './areas.service';
import { CriarEstruturaDto } from './dto/criar-estrutura.dto';
import { AtualizarEstruturaDto } from './dto/atualizar-estrutura.dto';
import { ListarEstruturaQuery } from './dto/listar-estrutura.query';
import { ExcluirEstruturaQuery } from './dto/excluir-estrutura.query';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Áreas da organização — aba Estrutura › Áreas.
 *
 * Sob `/empresa/...` para acompanhar `/empresa/membros` e `/empresa/roles`.
 * Leitura liberada a todo mundo do tenant (mesma decisão das outras rotas de
 * `/empresa`, e o formulário de membro precisa da lista para montar o
 * seletor); escrita exige `estrutura.gerenciar`, com o bypass de owner/admin
 * descrito no PermissoesGuard.
 *
 * `empresaId` NUNCA vem do cliente: sai sempre de `@CurrentUser()`, que é o
 * que garante o isolamento entre organizações.
 */
@Controller('empresa/areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  /** GET /empresa/areas?status=&q= → áreas do tenant, com contagem de membros. */
  @Get()
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarEstruturaQuery,
  ) {
    return this.areas.listar(user.empresaId, query);
  }

  /** GET /empresa/areas/:id */
  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.areas.obter(user.empresaId, id);
  }

  /** POST /empresa/areas → cria a área. Nasce sempre ativa. */
  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('estrutura.gerenciar')
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarEstruturaDto,
  ) {
    return this.areas.criar(user.empresaId, dto);
  }

  /**
   * PATCH /empresa/areas/:id → edita nome, descrição e status.
   *
   * Desativar (`status: 'inativo'`) é o caminho não destrutivo: preserva o
   * registro e não desfaz nenhuma associação de membro.
   */
  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('estrutura.gerenciar')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarEstruturaDto,
  ) {
    return this.areas.atualizar(user.empresaId, id, dto);
  }

  /**
   * DELETE /empresa/áreas/:id?realocarPara=<id|nenhuma> → exclui.
   *
   * Com colaboradores vinculados e SEM `realocarPara`, recusa com 409 e a
   * contagem: a resolução é sempre explícita. Com destino, move todo mundo e
   * exclui na mesma transação; com `nenhuma`, eles ficam sem área.
   */
  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('estrutura.gerenciar')
  @HttpCode(204)
  remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ExcluirEstruturaQuery,
  ) {
    return this.areas.remover(user.empresaId, id, query);
  }
}
