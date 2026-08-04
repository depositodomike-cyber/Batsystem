import axios from "@/utils/axios";

export type AiProviderId = "anthropic" | "openai";

export interface AiModelInfo {
  id: string;
  name: string;
}

export interface AiProviderInfo {
  id: AiProviderId;
  name: string;
  models: AiModelInfo[];
}

export interface AiConnection {
  provider: AiProviderId;
  model: string;
  keyLast4: string;
  status: "ativa" | "invalida";
  validatedAt: string | null;
}

export interface SetConnectionInput {
  provider: AiProviderId;
  model: string;
  apiKey: string;
}

/** Catálogo de provedores e modelos disponíveis. */
export async function getAiProviders(): Promise<AiProviderInfo[]> {
  const { data } = await axios.get<AiProviderInfo[]>("/ai/providers");
  return data;
}

/** Conexão de IA atual do tenant (ou null). */
export async function getAiConnection(): Promise<AiConnection | null> {
  const { data } = await axios.get<AiConnection | null>("/ai/connection");
  return data ?? null;
}

/** Conecta/substitui o provedor de IA (valida a chave no backend). */
export async function setAiConnection(
  input: SetConnectionInput,
): Promise<AiConnection> {
  const { data } = await axios.put<AiConnection>("/ai/connection", input);
  return data;
}

/** Remove a conexão de IA. */
export async function removeAiConnection(): Promise<void> {
  await axios.delete("/ai/connection");
}
