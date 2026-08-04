import type { Usuario } from '@prisma/client';

/** Formato `User` que o front espera (ts/demo/src/@types/user.ts). */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export function toUserResponse(usuario: Usuario): UserResponse {
  return {
    id: usuario.id,
    name: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    avatarUrl: usuario.avatarUrl ?? undefined,
  };
}
