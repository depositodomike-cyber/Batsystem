import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Usuario } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { toUserResponse, UserResponse } from './user.mapper';
import type { JwtPayload } from './jwt.strategy';

export interface LoginResult {
  authToken: string;
  user: UserResponse;
}

/** Hash de senha aleatória, usado para equalizar o tempo de login sem usuário. */
const DUMMY_HASH = bcrypt.hashSync('senha-invalida-para-timing', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Gera o JWT para um usuário. Reutilizado no cadastro (auto-login). */
  signToken(usuario: Pick<Usuario, 'id' | 'email' | 'empresaId' | 'role'>): string {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      empresaId: usuario.empresaId,
      role: usuario.role,
    };
    return this.jwt.sign(payload);
  }

  async login(email: string, senha: string): Promise<LoginResult> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Sempre executa um bcrypt.compare, mesmo sem usuário, para que o tempo
    // de resposta não revele se o e-mail existe (enumeração por timing).
    const senhaOk = await bcrypt.compare(
      senha,
      usuario?.senhaHash ?? DUMMY_HASH,
    );
    if (!usuario || !senhaOk) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    return {
      authToken: this.signToken(usuario),
      user: toUserResponse(usuario),
    };
  }

  async perfil(usuarioId: string): Promise<UserResponse> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return toUserResponse(usuario);
  }
}
