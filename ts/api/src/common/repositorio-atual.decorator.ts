import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Header em que o cliente envia o repositório (contexto) ativo. */
export const HEADER_REPOSITORIO = 'x-repositorio-id';

/**
 * Injeta o repositório ativo do request num handler.
 *
 * Vem por header, e não no corpo, porque o ValidationPipe global roda com
 * `forbidNonWhitelisted: true`: um campo extra no body faria toda requisição
 * falhar com 400, e incluí-lo exigiria alterar os DTOs de todos os endpoints de
 * IA. O header atravessa sem tocar em nenhum deles.
 *
 * Devolve `null` quando ausente. Quem consome o vault deve tratar isso como
 * "sem contexto": não ler nem gravar. Cair no escopo da empresa vazaria notas
 * entre repositórios, que é justamente o que este isolamento corrige.
 */
export const RepositorioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const bruto = request.headers?.[HEADER_REPOSITORIO];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    const limpo = (valor ?? '').trim();
    return limpo || null;
  },
);
