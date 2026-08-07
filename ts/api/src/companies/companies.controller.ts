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
import { CurrentUser } from '@/common/current-user.decorator';
import { Roles, RolesGuard } from '@/common/roles.guard';
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
   * POST /registrar → cadastro mínimo (nome, e-mail, senha, workspace).
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

  /** POST /empresa/convites → cria convites no tenant. Só admin/owner. */
  @Post('empresa/convites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
  convidar(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConvidarDto) {
    return this.companies.convidar(user.empresaId, dto.emails, dto.role);
  }

  /** DELETE /empresa/convites/:id → remove um convite do tenant. Só admin/owner. */
  @Delete('empresa/convites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'owner')
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
