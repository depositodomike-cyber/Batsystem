/**
 * Escopo de armazenamento por conta.
 *
 * Dados locais (localStorage / IndexedDB / sessionStorage) devem usar
 * `chaveConta(base)` para não vazar informações, arquivos ou configurações
 * entre contas no mesmo navegador.
 *
 * Preferência de identidade (do JWT):
 *   1. empresaId — isolamento por tenant
 *   2. email / sub — fallback (protótipo / tokens antigos)
 *   3. "anon" — sem sessão
 */

type JwtClaims = {
  empresaId?: string;
  email?: string;
  sub?: string;
};

function claimsDoToken(): JwtClaims | null {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return null;
    const parte = token.split(".")[1];
    if (!parte) return null;
    return JSON.parse(
      atob(parte.replace(/-/g, "+").replace(/_/g, "/")),
    ) as JwtClaims;
  } catch {
    return null;
  }
}

/** Identificador estável da conta atual (tenant ou usuário). */
export function escopoConta(): string {
  const claims = claimsDoToken();
  if (!claims) return "anon";
  const id =
    (claims.empresaId && String(claims.empresaId).trim()) ||
    (claims.email && String(claims.email).trim()) ||
    (claims.sub && String(claims.sub).trim()) ||
    "";
  return id ? id.toLowerCase() : "anon";
}

/** Chave namespaced: `base:escopo`. */
export function chaveConta(base: string): string {
  return `${base}:${escopoConta()}`;
}

/**
 * Lê uma chave de conta; se vazia, tenta a chave legada global uma vez
 * (migração de instalações single-user). Não copia entre contas distintas.
 */
export function lerComMigracao(
  base: string,
  storage: Storage = localStorage,
): string | null {
  const scoped = chaveConta(base);
  try {
    const atual = storage.getItem(scoped);
    if (atual != null) return atual;
    const legado = storage.getItem(base);
    if (legado == null) return null;
    // Só migra se ainda não existe dado da conta — e só para a conta logada.
    if (escopoConta() !== "anon") {
      try {
        storage.setItem(scoped, legado);
      } catch {
        /* cota */
      }
    }
    return legado;
  } catch {
    return null;
  }
}
