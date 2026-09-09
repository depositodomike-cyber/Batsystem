import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MemoriasService } from './memorias.service';
import { CreateMemoriaDto } from './dto/create-memoria.dto';
import { UpdateMemoriaDto } from './dto/update-memoria.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesService } from '@/acesso/roles.service';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Memória de longo prazo da IA, escopada à empresa (tenant) do usuário logado.
 * CRUD da página /<produto>/memoria.
 */
@Controller('memorias')
@UseGuards(JwtAuthGuard)
export class MemoriasController {
  constructor(
    private readonly memorias: MemoriasService,
    private readonly roles: RolesService,
  ) {}

  /**
   * Pode criar e alterar definição CORPORATIVA?
   *
   * Não é um gate da rota — é um argumento: sem isto a memória é criada como
   * pessoal, e é por isso que a checagem não virou `@RequerPermissao`.
   *
   * Antes lia só `Usuario.role`, e nenhuma role de plataforma o alcançava:
   * quem deixasse de ser owner ou admin perdia a memória corporativa para
   * sempre — e no POST perdia EM SILÊNCIO, porque a nota simplesmente virava
   * pessoal. Agora reproduz a regra do `PermissoesGuard`: bypass de
   * owner/admin, senão a união das roles do membro.
   */
  private async podeDefinirCorporativa(
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const contexto = await this.roles.contextoDeAutorizacao(
      user.empresaId,
      user.id,
    );
    // Mesma condição do `PermissoesGuard`, incluindo a exceção do convidado:
    // fixar uma definição da ORGANIZAÇÃO é ato de quem faz parte dela.
    if (
      !contexto.convidado &&
      (user.role === 'owner' || user.role === 'admin')
    ) {
      return true;
    }
    return contexto.permissoes.includes('configuracoes.gerenciar');
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.memorias.list(user.empresaId);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemoriaDto,
  ) {
    return this.memorias.create(
      user.empresaId,
      dto,
      await this.podeDefinirCorporativa(user),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemoriaDto,
  ) {
    return this.memorias.update(
      user.empresaId,
      id,
      dto,
      await this.podeDefinirCorporativa(user),
    );
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.memorias.remove(
      user.empresaId,
      id,
      await this.podeDefinirCorporativa(user),
    );
  }
}
