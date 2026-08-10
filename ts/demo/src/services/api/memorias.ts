import axios from "@/utils/axios";
import type { MemoryItem, MemoryConfidence } from "@/app/data/memoria";

// ----------------------------------------------------------------------
// Cliente da API de Memória (backend NestJS: /memorias, escopo por empresa).
// O backend retorna `date` em ISO 8601 — a UI formata para exibição.
// ----------------------------------------------------------------------

export interface CreateMemoryPayload {
  /** Tema (pasta do Repositório). Omitido pela tela de Regras — o backend
   * grava o tema padrão. Ainda usado pelos fluxos que gravam em uma pasta. */
  category?: string;
  title: string;
  content: string;
  source?: string;
  confidence?: MemoryConfidence;
  /** Fixar como definição corporativa (só honrado para admin/owner no backend). */
  corporate?: boolean;
}

export type UpdateMemoryPayload = Partial<{
  category: string;
  title: string;
  content: string;
  source: string;
  confidence: MemoryConfidence;
  active: boolean;
}>;

/** GET /memorias — todas as memórias da empresa. */
export async function fetchMemoriesApi(): Promise<MemoryItem[]> {
  const { data } = await axios.get<MemoryItem[]>("/memorias");
  return data;
}

/** POST /memorias — cria uma memória. */
export async function createMemoryApi(
  payload: CreateMemoryPayload,
): Promise<MemoryItem> {
  const { data } = await axios.post<MemoryItem>("/memorias", payload);
  return data;
}

/** PATCH /memorias/:id — atualização parcial (inclui toggles ativa/fixada). */
export async function updateMemoryApi(
  id: string,
  payload: UpdateMemoryPayload,
): Promise<MemoryItem> {
  const { data } = await axios.patch<MemoryItem>(
    `/memorias/${encodeURIComponent(id)}`,
    payload,
  );
  return data;
}

/** DELETE /memorias/:id — remove a memória. */
export async function deleteMemoryApi(id: string): Promise<void> {
  await axios.delete(`/memorias/${encodeURIComponent(id)}`);
}
