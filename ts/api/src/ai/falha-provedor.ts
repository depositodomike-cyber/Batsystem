import { HttpException } from '@nestjs/common';

/**
 * Classificação de erros vindos dos provedores de IA, usada pelo failover:
 * quando o modelo do topo da fila falha, decidimos aqui se vale tentar o
 * próximo modelo configurado pelo tenant.
 */

/** Status HTTP em que trocar de modelo tem chance real de resolver. */
const STATUS_FAILOVER = new Set([401, 403, 404, 408, 409, 429]);

/** Status HTTP do erro do SDK, quando existe. */
export function statusDoErro(err: unknown): number | undefined {
  if (!err || typeof err !== 'object' || !('status' in err)) return undefined;
  const status = Number((err as { status?: unknown }).status);
  return Number.isFinite(status) ? status : undefined;
}

/** true quando a chave foi rejeitada pelo provedor (inválida ou sem permissão). */
export function ehChaveRejeitada(err: unknown): boolean {
  const status = statusDoErro(err);
  return status === 401 || status === 403;
}

/**
 * true quando a falha é do provedor/modelo e não da nossa requisição — ou seja,
 * quando vale tentar o próximo modelo da fila. Erros que nós mesmos lançamos
 * (HttpException) e 400 (payload inválido) falhariam igual em qualquer modelo.
 */
export function ehFalhaDeProvedor(err: unknown): boolean {
  if (err instanceof HttpException) return false;
  const status = statusDoErro(err);
  // Sem status é tipicamente rede/timeout: outro provedor pode estar de pé.
  if (status === undefined) return true;
  return STATUS_FAILOVER.has(status) || status >= 500;
}
