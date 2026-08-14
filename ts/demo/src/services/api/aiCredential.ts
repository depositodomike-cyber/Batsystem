import axios from "@/utils/axios";

/**
 * Chaves de API do tenant (BYOK). Uma credencial é um provedor + chave
 * (+ nome opcional). Os modelos de Texto/Imagem/Vídeo apontam para cá.
 * A chave nunca volta do servidor.
 */

export type AiModality = "text" | "image" | "video";

export interface CatalogModel {
  id: string;
  name: string;
  modality: AiModality;
}

export interface CatalogProvider {
  id: string;
  name: string;
  modalities: AiModality[];
  models: CatalogModel[];
}

export interface AiCredential {
  id: string;
  provider: string;
  nome: string | null;
  keyLast4: string;
  status: "ativa" | "invalida";
  validatedAt: string | null;
  modelCount: number;
}

export interface CreateCredentialInput {
  provider: string;
  apiKey: string;
  nome?: string;
}

/** Catálogo unificado (texto + imagem + vídeo). */
export async function getAiProviders(): Promise<CatalogProvider[]> {
  const { data } = await axios.get<CatalogProvider[]>("/ai/providers");
  return data ?? [];
}

export async function listAiCredentials(): Promise<AiCredential[]> {
  const { data } = await axios.get<AiCredential[]>("/ai/credentials");
  return data ?? [];
}

export async function createAiCredential(
  input: CreateCredentialInput,
): Promise<AiCredential> {
  const { data } = await axios.post<AiCredential>("/ai/credentials", input);
  return data;
}

export async function removeAiCredential(id: string): Promise<void> {
  await axios.delete(`/ai/credentials/${id}`);
}
