import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GeradoresTextoService } from './geradores-texto.service';
import type { Melhorado } from './melhorar/prompts';
import type { DesignSystemDto } from './design/design';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface MelhorarBody {
  texto?: string;
  instrucoes?: string;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

@Controller('ai')
// Usar a IA exige `ia.usar` (todas as roles de sistema a têm).
@UseGuards(JwtAuthGuard, PermissoesGuard)
@RequerPermissao('ia.usar')
export class MelhorarController {
  constructor(private readonly geradores: GeradoresTextoService) {}

  /**
   * POST /ai/melhorar → reescreve um texto (mais claro/forte), sem mudar o
   * sentido. Body: { texto, instrucoes? }. Retorna { texto, resumo }.
   */
  @Post('melhorar')
  melhorar(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: MelhorarBody,
  ): Promise<Melhorado> {
    return this.geradores.melhorar(user, repositorioId, body);
  }
}
