import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { MarcasService } from './marcas.service';
import { SalvarMarcaDto } from './dto/salvar-marca.dto';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Guias de marca da organização — Configurações › Geral › Aparência › Guia de
 * marca.
 *
 * Sob `/empresa/...` para acompanhar `/empresa/areas` e `/empresa/roles`.
 *
 * Leitura LIBERADA a todo o tenant, mesma decisão de Áreas: as onze telas do AI
 * Studio montam o seletor de marca a partir desta lista, e quem só gera conteúdo
 * não administra nada. Escrita exige `configuracoes.gerenciar` — o mesmo código
 * que já governa o resto de Configurações, com o bypass de owner/admin descrito
 * no PermissoesGuard. Não há autorização paralela aqui.
 *
 * `empresaId` NUNCA vem do cliente: sai sempre de `@CurrentUser()`, que é o que
 * garante o isolamento entre organizações.
 */
@Controller('empresa/marcas')
@UseGuards(JwtAuthGuard)
export class MarcasController {
  constructor(private readonly marcas: MarcasService) {}

  /** GET /empresa/marcas → todas as marcas do tenant, documento completo. */
  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.marcas.listar(user.empresaId);
  }

  /** GET /empresa/marcas/:id */
  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.marcas.obter(user.empresaId, id);
  }

  /** POST /empresa/marcas → cria a marca a partir do design system enviado. */
  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  criar(@CurrentUser() user: AuthenticatedUser, @Body() dto: SalvarMarcaDto) {
    return this.marcas.criar(user.empresaId, dto);
  }

  /** PUT /empresa/marcas/:id → substitui o design system inteiro. */
  @Put(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  substituir(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SalvarMarcaDto,
  ) {
    return this.marcas.substituir(user.empresaId, id, dto);
  }

  /**
   * DELETE /empresa/marcas/:id → exclui.
   *
   * Sem 409 e sem realocação, ao contrário de Áreas e Cargos: nada no banco
   * referencia uma Marca, e o conteúdo já gerado carrega o design embutido —
   * excluir não desfaz vínculo nem muda nenhuma apresentação existente.
   */
  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  @HttpCode(204)
  remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.marcas.remover(user.empresaId, id);
  }
}
