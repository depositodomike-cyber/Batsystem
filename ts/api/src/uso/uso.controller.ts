import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { UsoTokensService, type UsoResumo } from './uso-tokens.service';

@Controller('uso')
@UseGuards(JwtAuthGuard)
export class UsoController {
  constructor(private readonly uso: UsoTokensService) {}

  /**
   * GET /uso/tokens → consumo de tokens da IA do usuário logado nas janelas
   * de 1h/24h/7d. Alimenta o contador do header.
   */
  @Get('tokens')
  tokens(@CurrentUser() user: AuthenticatedUser): Promise<UsoResumo> {
    return this.uso.resumo(user.id);
  }
}
