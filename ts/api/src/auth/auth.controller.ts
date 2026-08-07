import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from './jwt.strategy';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /login → { authToken, user } (contrato do front). */
  @Post('login')
  @HttpCode(200)
  // Limite contra força bruta. O contador é por IP e não distingue acerto de
  // erro, então 5/min derrubava quem só errou a senha uma vez ou recarregou a
  // tela; 10/min continua lento demais para um ataque.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  /** GET /user/profile → { user } (header Authorization: Bearer). */
  @Get('user/profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: AuthenticatedUser) {
    return { user: await this.auth.perfil(user.id) };
  }
}
