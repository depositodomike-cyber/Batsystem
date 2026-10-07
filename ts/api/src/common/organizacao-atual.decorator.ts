import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Header em que o cliente envia a organização ativa. */
export const HEADER_ORGANIZACAO = 'x-organizacao-id';

/**
 * Injeta a organização ativa do request num handler — o dono do Repositório
 * da organização (ver `RepositorioOrgService`).
 *
 * Mesmo desenho de `RepositorioAtual`, e pelo mesmo motivo: vem por header
 * porque o ValidationPipe global roda com `forbidNonWhitelisted: true`. São
 * dois headers, e não um, porque são dois donos diferentes — o repositório
 * ativo é a pasta local do protótipo; a organização é dona da base de
 * conhecimento compartilhada. Misturar os dois faria um documento da
 * organização sumir ao trocar de pasta.
 *
 * Devolve `null` quando ausente, e quem consome trata isso como "sem
 * organização": não lê nem grava.
 */
export const OrganizacaoAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const bruto = request.headers?.[HEADER_ORGANIZACAO];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    const limpo = (valor ?? '').trim();
    return limpo || null;
  },
);
