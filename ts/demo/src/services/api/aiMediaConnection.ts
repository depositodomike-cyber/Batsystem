import axios from "@/utils/axios";

/**
 * Conexões de IA de mídia (Imagem e Vídeo) — BYOK, persistidas no backend
 * (`/ai/media/:kind`). A de `image` é usada SÓ em "Criar Imagem" e a de
 * `video` SÓ em "Criar Vídeo"; o restante da aplicação usa a conexão de Texto
 * (`aiConnection.ts`). A chave nunca volta do servidor — só os 4 últimos
 * dígitos, para exibição.
 */

export type AiMediaKind = "image" | "video";

export interface AiModelInfo {
  id: string;
  name: string;
}

export interface AiProviderInfo {
  id: string;
  name: string;
  models: AiModelInfo[];
}

export interface AiConnection {
  provider: string;
  model: string;
  keyLast4: string;
  status: "ativa" | "invalida";
  validatedAt: string | null;
}

export interface SetConnectionInput {
  provider: string;
  model: string;
  apiKey: string;
}

/** Catálogo de provedores/modelos da modalidade (fonte: backend). */
export async function getAiMediaProviders(
  kind: AiMediaKind,
): Promise<AiProviderInfo[]> {
  const { data } = await axios.get<AiProviderInfo[]>(
    `/ai/media/${kind}/providers`,
  );
  return data;
}

/** Conexão atual da modalidade (ou null). */
export async function getAiMediaConnection(
  kind: AiMediaKind,
): Promise<AiConnection | null> {
  const { data } = await axios.get<AiConnection | null>(`/ai/media/${kind}`);
  return data ?? null;
}

/** Conecta/substitui a chave da modalidade (criptografada no backend). */
export async function setAiMediaConnection(
  kind: AiMediaKind,
  input: SetConnectionInput,
): Promise<AiConnection> {
  const { data } = await axios.put<AiConnection>(`/ai/media/${kind}`, input);
  return data;
}

/** Remove a conexão da modalidade. */
export async function removeAiMediaConnection(kind: AiMediaKind): Promise<void> {
  await axios.delete(`/ai/media/${kind}`);
}
