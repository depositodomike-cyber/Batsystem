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
import { CargosService } from './cargos.service';
import { CriarEstruturaDto } from './dto/criar-estrutura.dto';
import { AtualizarEstruturaDto } from './dto/atualizar-estrutura.dto';
import { ListarEstruturaQuery } from './dto/listar-estrutura.query';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Cargos da organização — aba Estrutura › Cargos.
 *
 * Mesma política de `AreasController`: leitura liberada ao tenant (o
 * formulário de membro precisa da lista), escrita exige
 * `estrutura.gerenciar`, e `empresaId` vem sempre de `@CurrentUser()`.
 */
@Controller('empresa/cargos')
@UseGuards(JwtAuthGuard)
export class CargosController {
  constructor(private readonly cargos: CargosService) {}

  /** GET /empresa/cargos?status=&q= → cargos do tenant, com contagem. */
  @Get()
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarEstruturaQuery,
  ) {
    return this.cargos.listar(user.empresaId, query);
  }

  /** GET /empresa/cargos/:id */
  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cargos.obter(user.empresaId, id);
  }

  /** POST /empresa/cargos → cria o cargo. Nasce sempre ativo. */
  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('estrutura.gerenciar')
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarEstruturaDto,
  ) {
    return this.cargos.criar(user.empresaId, dto);
  }

  /** PATCH /empresa/cargos/:id → edita nome, descrição e status. */
  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('estrutura.gerenciar')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarEstruturaDto,
  ) {
    return this.cargos.atualizar(user.empresaId, id, dto);
  }

  /**
   * DELETE /empresa/cargos/:id → exclui um cargo sem membros.
   *
   * Com membros vinculados recusa com 409 e a contagem, orientando a
   * desativar.
   */
  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('estrutura.gerenciar')
  @HttpCode(204)
  remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cargos.remover(user.empresaId, id);
  }
}
