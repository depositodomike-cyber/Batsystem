import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';

export interface JwtPayload {
  /** id do usuário */
  sub: string;
  email: string;
  empresaId: string;
  role: string;
}

/** Usuário autenticado anexado a `request.user`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  empresaId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, empresaId: true, role: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return usuario;
  }
}
