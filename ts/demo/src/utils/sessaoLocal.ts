/**
 * Sessão em "modo local".
 *
 * Quando o backend está indisponível no login, `garantirSessaoBackend`
 * (services/api/contaBackend.ts) devolve `{ tipo: "local" }` e o front entra
 * com um token fabricado no próprio navegador — `alg: "none"`, assinatura
 * literal `prototype`. Isso deixa a UI saber quem é o usuário, mas o backend
 * rejeita esse token: toda rota autenticada responde 401.
 *
 * O estado dura até o próximo login (12 h de `exp`) e não se recupera sozinho,
 * porque refazer a sessão real exigiria a senha, que não fica guardada. Por
 * isso o produto precisa reconhecê-lo e dizer ao usuário para entrar de novo,
 * em vez de deixar vazar o "Unauthorized" cru do Nest.
 *
 * Módulo sem imports de propósito: é consumido tanto pelo interceptor do axios
 * quanto pelo contexto de auth, e um import cruzado criaria ciclo.
 */

export const PROTOTYPE_TOKEN_SUFFIX = ".prototype";

export function isPrototypeToken(
  authToken: string | null | undefined,
): boolean {
  return (
    typeof authToken === "string" && authToken.endsWith(PROTOTYPE_TOKEN_SUFFIX)
  );
}

/** Há uma sessão local ativa neste navegador? */
export function sessaoLocalAtiva(): boolean {
  try {
    return isPrototypeToken(window.localStorage.getItem("authToken"));
  } catch {
    // localStorage pode lançar (modo privado, cookies bloqueados).
    return false;
  }
}
