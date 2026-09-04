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
import { MembrosService } from './membros.service';
import { CriarMembroDto } from './dto/criar-membro.dto';
import { AtualizarMembroDto } from './dto/atualizar-membro.dto';
import { ExcluirMembroQuery } from './dto/excluir-membro.query';
import { ListarMembrosQuery } from './dto/listar-membros.query';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Membros da organização — aba Membros da tela de Administração.
 *
 * Rotas sob `/empresa/...` para ficarem coerentes com `/empresa/convites`, que
 * o onboarding já usa. Leitura liberada a todo mundo do tenant (todos podem ver
 * o time, mesma decisão de `GET /empresa/convites`).
 *
 * Escrita: passa pelo PermissoesGuard da V3, que concede a owner/admin da conta
 * (bypass legado, o mesmo alcance de antes) OU a quem tem a permissão pela role
 * da plataforma. Só AMPLIA: ninguém que escrevia antes deixou de escrever.
 */
@Controller('empresa/membros')
@UseGuards(JwtAuthGuard)
export class MembrosController {
  constructor(private readonly membros: MembrosService) {}

  /** GET /empresa/membros?status=&q= → membros do tenant. */
  @Get()
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarMembrosQuery,
  ) {
    return this.membros.listar(user.empresaId, query);
  }

  /** GET /empresa/membros/:id → um membro do tenant. */
  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.membros.obter(user.empresaId, id);
  }

  /** POST /empresa/membros → cria o membro (default: convite pendente). */
  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('membros.criar')
  criar(@CurrentUser() user: AuthenticatedUser, @Body() dto: CriarMembroDto) {
    return this.membros.criar(user.empresaId, dto);
  }

  /** PATCH /empresa/membros/:id → edita nome/e-mail/área/cargo/status. */
  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('membros.editar')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarMembroDto,
  ) {
    return this.membros.atualizar(user.empresaId, id, dto, user.id);
  }

  /**
   * DELETE /empresa/membros/:id?reatribuirLiderados=<membroId>
   *
   * Cancela um convite (só membro sem conta). Se o membro lidera alguém, a
   * chamada é recusada com 409 e a contagem até vir a nova liderança: a
   * realocação e a exclusão acontecem na mesma transação.
   *
   * Segue sob `membros.desativar`: a realocação é consequência da saída, não
   * uma edição independente — mesma leitura do DELETE de role, que reescreve o
   * `roleId` dos membros sob a permissão da própria exclusão.
   */
  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('membros.desativar')
  @HttpCode(204)
  remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ExcluirMembroQuery,
  ) {
    return this.membros.remover(user.empresaId, id, user.id, query);
  }
}
