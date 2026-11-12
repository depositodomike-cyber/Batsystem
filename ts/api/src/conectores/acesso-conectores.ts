import { ForbiddenException, Injectable } from '@nestjs/common';
import { RolesService } from '@/acesso/roles.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { ehPessoal, permissaoParaAlterar } from './titular';

/**
 * Quem pode alterar qual conexão. A permissão depende do conector pedido
 * (pessoal ou da organização), por isso não cabe num decorator fixo de rota.
 */
@Injectable()
export class AcessoConectores {
  constructor(private readonly roles: RolesService) {}

  async exigirPodeAlterar(user: AuthenticatedUser, connectorId: string): Promise<void> {
    if (await this.roles.pode(user, permissaoParaAlterar(connectorId))) return;
    throw new ForbiddenException(
      ehPessoal(connectorId)
        ? 'A sua role não permite conectar contas pessoais. Fale com um administrador da organização.'
        : 'Só quem administra a organização pode alterar este conector.',
    );
  }
}
