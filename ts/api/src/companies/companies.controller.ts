import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CompaniesService } from './companies.service';
import { CadastroDto } from './dto/cadastro.dto';
import { ConvidarDto } from './dto/convidar.dto';
import { RegistrarDto } from './dto/registrar.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

@Controller()
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  /** POST /cadastro → cria empresa + owner + trial. Público. */
  @Post('cadastro')
  // Endpoint público de escrita: limite estrito contra criação em massa.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  cadastrar(@Body() dto: CadastroDto) {
    return this.companies.cadastrar(dto);
  }

  /**
   * POST /registrar → cadastro mínimo (nome, e-mail, senha, organização).
   * Público. Mesmo resultado do /cadastro, sem cobrança/documento.
   */
  @Post('registrar')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  registrar(@Body() dto: RegistrarDto) {
    return this.companies.registrar(dto);
  }

  /** GET /cadastro/email-disponivel?email= → { disponivel }. Público. */
  @Get('cadastro/email-disponivel')
  // Responde se um e-mail existe: limitado para dificultar enumeração em massa.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async emailDisponivel(@Query('email') email: string) {
    const jaExiste = await this.companies.emailJaCadastrado(email ?? '');
    return { disponivel: !jaExiste };
  }

  /** GET /empresa → dados do tenant do usuário logado. */
  @Get('empresa')
  @UseGuards(JwtAuthGuard)
  empresaAtual(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.getEmpresa(user.empresaId);
  }

  /** GET /empresa/convites → convites do tenant. */
  @Get('empresa/convites')
  @UseGuards(JwtAuthGuard)
  convites(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.convitesDaEmpresa(user.empresaId);
  }

  /**
   * POST /empresa/convites → cria convites no tenant.
   *
   * Passou de `@Roles('admin','owner')` para a camada de permissões: convidar
   * é criar membro, então `membros.criar` é o código do catálogo que descreve
   * a ação. Aditivo — o `PermissoesGuard` mantém o bypass de owner/admin,
   * então quem passava continua passando, e agora uma role com `membros.criar`
   * também passa.
   *
   * Antes, este gate lia só `Usuario.role` e nenhuma role de plataforma o
   * alcançava: quem deixasse de ser owner ou admin perdia convites para
   * sempre, mesmo com uma role de acesso total.
   */
  @Post('empresa/convites')
  @UseGuards(JwtAuthGuard, PermissoesGuard)
  @RequerPermissao('membros.criar')
  convidar(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConvidarDto) {
    return this.companies.convidar(user.empresaId, dto.emails, dto.role);
  }

  /** DELETE /empresa/convites/:id → remove um convite. Ver o POST acima. */
  @Delete('empresa/convites/:id')
  @UseGuards(JwtAuthGuard, PermissoesGuard)
  @RequerPermissao('membros.criar')
  removerConvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.companies.removerConvite(user.empresaId, id);
  }

  /** POST /empresa/onboarding/concluir → marca onboarding concluído. */
  @Post('empresa/onboarding/concluir')
  @UseGuards(JwtAuthGuard)
  concluirOnboarding(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.concluirOnboarding(user.empresaId);
  }
}
