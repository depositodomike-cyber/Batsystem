import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsObject } from 'class-validator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { PerfilService } from './perfil.service';
import { ehCategoriaPerfil } from './perfil.tipos';

class SalvarCategoriaDto {
  /** Valor da categoria; reduzido ao formato dela em `normalizarCategoria`. */
  @IsObject()
  valor!: Record<string, unknown>;
}

/**
 * Perfil Pessoal (Configurações do Usuário). Pertence ao usuário do JWT: não
 * lê `X-Organizacao-Id` nem aceita id de usuário do cliente — o mesmo perfil
 * vale em qualquer organização ativa e ninguém lê o de outra pessoa.
 */
@Controller('perfil')
@UseGuards(JwtAuthGuard)
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Get()
  obter(@CurrentUser() user: AuthenticatedUser) {
    return this.perfil.obter(user.empresaId, user.id);
  }

  @Put(':categoria')
  salvar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoria') categoria: string,
    @Body() body: SalvarCategoriaDto,
  ) {
    if (!ehCategoriaPerfil(categoria)) {
      throw new BadRequestException('Categoria do perfil desconhecida.');
    }
    return this.perfil.salvarCategoria(user.empresaId, user.id, categoria, body.valor);
  }

  @Delete()
  async excluir(@CurrentUser() user: AuthenticatedUser) {
    await this.perfil.excluir(user.empresaId, user.id);
    return { ok: true };
  }
}
