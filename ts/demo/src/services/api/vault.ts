import axios from "@/utils/axios";

// Cliente do Vault de notas .md (backend NestJS: /ai/vault). O conteúdo dos
// arquivos é lido no navegador (File System Access API, na tela Memória) e
// sincronizado aqui em lotes; o /ai/prompt recupera as notas relevantes.

export interface VaultNotaInput {
  path: string;
  titulo: string;
  conteudo: string;
}

/** Tamanho do lote de upload. Mantém o payload longe do limite do body-parser. */
export const VAULT_BATCH_SIZE = 40;

/** POST /ai/vault/sync/batch — envia um lote (o backend pula inalteradas). */
export async function syncVaultBatch(
  notas: VaultNotaInput[],
): Promise<{ gravadas: number; inalteradas: number }> {
  const { data } = await axios.post<{ gravadas: number; inalteradas: number }>(
    "/ai/vault/sync/batch",
    { notas },
  );
  return data;
}

/** POST /ai/vault/sync/finalize — poda as notas que saíram da pasta. */
export async function finalizeVaultSync(
  paths: string[],
): Promise<{ total: number; removidas: number }> {
  const { data } = await axios.post<{ total: number; removidas: number }>(
    "/ai/vault/sync/finalize",
    { paths },
  );
  return data;
}

/** Referência de nota do vault (sem conteúdo) — alvo de um [[wikilink]]. */
export interface VaultNotaRef {
  path: string;
  titulo: string;
}

/**
 * GET /ai/vault/notas — títulos das notas para o autocomplete de "[[".
 * Sem `q`, devolve as mais recentes (lista que abre junto com o gatilho).
 */
export async function buscarNotasVault(
  q = "",
  limit = 200,
): Promise<VaultNotaRef[]> {
  const { data } = await axios.get<{ notas: VaultNotaRef[] }>("/ai/vault/notas", {
    params: { q: q || undefined, limit },
  });
  return data.notas ?? [];
}

/** GET /ai/vault — status (total de notas sincronizadas). */
export async function getVaultStatus(): Promise<{ total: number }> {
  const { data } = await axios.get<{ total: number }>("/ai/vault");
  return data;
}

/**
 * Sincroniza a pasta inteira: envia as notas em lotes e depois poda as
 * removidas. `onProgress` reporta quantas já foram processadas, para a UI.
 */
export async function syncVault(
  notas: VaultNotaInput[],
  onProgress?: (enviadas: number, total: number) => void,
): Promise<{ total: number; gravadas: number }> {
  let gravadas = 0;
  for (let i = 0; i < notas.length; i += VAULT_BATCH_SIZE) {
    const lote = notas.slice(i, i + VAULT_BATCH_SIZE);
    const r = await syncVaultBatch(lote);
    gravadas += r.gravadas;
    onProgress?.(Math.min(i + lote.length, notas.length), notas.length);
  }
  const fim = await finalizeVaultSync(notas.map((n) => n.path));
  return { total: fim.total, gravadas };
}
