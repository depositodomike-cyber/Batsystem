// Id de correlação por requisição: toda linha de log emitida durante uma
// requisição — inclusive em promessas que ela dispara (título refinado,
// registro de uso) — sai com o mesmo `[req <id>]`. É o fio que vai ligar as
// etapas de uma execução do orquestrador nos logs.
//
// O id vem do header `X-Request-Id` quando o cliente manda um válido (para
// casar com logs do front), senão é gerado; e volta no header da resposta.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { ConsoleLogger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const HEADER_CORRELACAO = 'X-Request-Id';

const armazenamento = new AsyncLocalStorage<{ id: string }>();

/** Só aceitamos ids curtos e sem caracteres de controle vindos do cliente. */
const ID_VALIDO = /^[A-Za-z0-9._-]{1,64}$/;

/** Id da requisição em curso (`undefined` fora de uma requisição). */
export function idDaRequisicao(): string | undefined {
  return armazenamento.getStore()?.id;
}

/** Roda `fn` sob um id de correlação (para jobs e testes). */
export function comCorrelacao<T>(id: string, fn: () => T): T {
  return armazenamento.run({ id }, fn);
}

export function middlewareCorrelacao(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const recebido = req.header(HEADER_CORRELACAO);
  const id = recebido && ID_VALIDO.test(recebido) ? recebido : randomUUID();
  res.setHeader(HEADER_CORRELACAO, id);
  armazenamento.run({ id }, next);
}

/** ConsoleLogger do Nest com o id da requisição logo depois do contexto. */
export class LoggerComCorrelacao extends ConsoleLogger {
  protected formatContext(context: string): string {
    const base = super.formatContext(context);
    const id = idDaRequisicao();
    return id ? `${base}[req ${id}] ` : base;
  }
}
