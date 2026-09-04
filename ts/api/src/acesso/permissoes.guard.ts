import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { RolesService } from './roles.service';

export const PERMISSAO_KEY = 'permissao';

/**
 * Exige uma permissão do catálogo no handler. Use junto com JwtAuthGuard.
 *
 *   @UseGuards(JwtAuthGuard, PermissoesGuard)
 *   @RequerPermissao('membros.criar')
 */
export const RequerPermissao = (permissao: string) =>
  SetMetadata(PERMISSAO_KEY, permissao);

/**
 * Guard da camada de permissões da V3.
 *
 * A regra é deliberadamente PERMISSIVA em relação ao que existia antes:
 *
 *   passa se  Usuario.role é owner ou admin        (bypass legado)
 *        ou   a Role do membro concede a permissão (camada nova)
 *
 * O bypass não é preguiça: `Usuario.role` é o gate que sempre governou esta
 * API, e o Owner precisa continuar administrando a organização mesmo sem role
 * de plataforma atribuída — é o que impede a organização de ficar sem acesso
 * administrativo por uma configuração infeliz de role.
 *
 * A consequência prática é que a V3 só AMPLIA acesso: quem podia agir continua
 * podendo, e um membro comum passa a poder quando a role dele concede. Nenhum
 * comportamento existente é retirado.
 *
 * Nota de escopo: só as rotas de Membros e Roles usam este guard. Aplicar as
 * demais permissões do catálogo aos outros controllers seria refatorar
 * autorização em toda a plataforma, o que está fora desta versão — o catálogo
 * já existe e o ponto de aplicação é este arquivo.
 */
@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissao = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSAO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permissao) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Sessão inválida.');
    }

    if (user.role === 'owner' || user.role === 'admin') return true;

    const concedidas = await this.roles.permissoesDoUsuario(
      user.empresaId,
      user.id,
    );
    if (concedidas.includes(permissao)) return true;

    throw new ForbiddenException(
      'A sua role não permite esta ação. Fale com um administrador da organização.',
    );
  }
}
