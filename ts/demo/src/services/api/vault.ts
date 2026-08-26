import axios from "@/utils/axios";

// Cliente do Vault de notas .md (backend NestJS: /ai/vault). O conteúdo dos
// arquivos é lido no navegador (File System Access API, na telo Repositório) e
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

// ---------- Categorias macro (descobertas pela IA no backend) ----------

export interface CategoriaVault {
  slug: string;
  label: string;
  definicao: string | null;
}

export interface CategoriasDoVault {
  categorias: CategoriaVault[];
  /** path → slugs das categorias daquela nota. */
  porPath: Record<string, string[]>;
}

/** GET /ai/vault/categorias — vocabulário confirmado + o mapa path→categorias. */
export async function getVaultCategorias(): Promise<CategoriasDoVault> {
  try {
    const { data } = await axios.get<CategoriasDoVault>("/ai/vault/categorias");
    return { categorias: data?.categorias ?? [], porPath: data?.porPath ?? {} };
  } catch {
    // Sem categorias o grafo monta como antes desta funcionalidade — nunca é
    // motivo para a tela falhar.
    return { categorias: [], porPath: {} };
  }
}

export interface ResultadoClassificacao {
  processadas: number;
  pendentes: number;
  vocabulario: number;
  /** Presente quando a IA não pôde ser consultada — encerra o laço. */
  erro?: string;
}

/** POST /ai/vault/classificar — classifica a próxima fatia de notas pendentes. */
export async function classificarVault(): Promise<ResultadoClassificacao> {
  const { data } = await axios.post<ResultadoClassificacao>(
    "/ai/vault/classificar",
  );
  return data;
}

/**
 * Classifica em laço até não sobrar pendência.
 *
 * O backend processa poucas notas por chamada de propósito (uma chamada de IA
 * por nota dentro de um único request levaria minutos e encostaria no teto da
 * função serverless). Para o usuário isto é uma etapa do Sincronizar.
 *
 * Nunca lança: sem IA conectada, o backend devolve `erro` e o laço encerra em
 * silêncio, deixando o grafo como era. Também para se uma volta não avançar,
 * para nunca girar à toa.
 */
export async function classificarVaultCompleto(
  onProgress?: (feitas: number, total: number) => void,
): Promise<{ classificadas: number; pendentes: number; erro?: string }> {
  let classificadas = 0;
  let pendentes = 0;
  for (;;) {
    let r: ResultadoClassificacao;
    try {
      r = await classificarVault();
    } catch {
      return { classificadas, pendentes, erro: "Falha ao falar com o servidor." };
    }
    classificadas += r.processadas;
    pendentes = r.pendentes;
    onProgress?.(classificadas, classificadas + r.pendentes);
    if (r.erro) return { classificadas, pendentes, erro: r.erro };
    if (r.pendentes === 0 || r.processadas === 0) break;
  }
  return { classificadas, pendentes };
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
