import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GeradoresTextoService } from './geradores-texto.service';
import type { Artigo } from './artigo/prompts';
import type { DesignSystemDto } from './design/design';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface ArtigoBody {
  tema?: string;
  contexto?: string;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Artigo | null;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

@Controller('ai')
// Usar a IA exige `ia.usar` (todas as roles de sistema a têm).
@UseGuards(JwtAuthGuard, PermissoesGuard)
@RequerPermissao('ia.usar')
export class ArtigoController {
  constructor(private readonly geradores: GeradoresTextoService) {}

  /**
   * POST /ai/artigo → gera (ou refina) um artigo em Markdown.
   * Body: { tema, contexto?, fontes?(['memoria']), referencia?, ajuste?, anterior? }.
   * Retorna { titulo, subtitulo, conteudo }.
   */
  @Post('artigo')
  artigo(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: ArtigoBody,
  ): Promise<Artigo> {
    return this.geradores.artigo(user, repositorioId, body);
  }
}
