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
 * Nota de escopo: usam este guard as rotas de Membros, Roles, Áreas, Cargos,
 * Convites e chaves MCP. Os demais controllers ainda não passam por aqui —
 * aplicar o catálogo inteiro seria refatorar autorização em toda a plataforma,
 * o que segue fora de escopo; o catálogo já existe e o ponto de aplicação é
 * este arquivo.
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

    const contexto = await this.roles.contextoDeAutorizacao(
      user.empresaId,
      user.id,
    );

    // O bypass legado deixa de ser incondicional. Um membro CONVIDADO nunca
    // administra a organização, qualquer que seja `Usuario.role` — sem esta
    // condição, um convidado cuja conta seja proprietária ou administradora
    // (estado alcançável por SQL, e por qualquer fluxo de aceite de convite que
    // venha a existir) teria acesso total, e o tipo seria só um rótulo.
    //
    // Derivar do `tipo` em vez de gravar um rebaixamento em `Usuario.role` é o
    // que mantém a regra reversível: quem volta a ser membro recupera o bypass
    // no request seguinte, sem nada para desfazer.
    if (
      !contexto.convidado &&
      (user.role === 'owner' || user.role === 'admin')
    ) {
      return true;
    }

    if (contexto.permissoes.includes(permissao)) return true;

    throw new ForbiddenException(
      'A sua role não permite esta ação. Fale com um administrador da organização.',
    );
  }
}
