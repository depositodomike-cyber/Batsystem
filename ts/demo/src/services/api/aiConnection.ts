import axios from "@/utils/axios";

/**
 * Fila de modelos de texto do tenant. Cada item aponta para uma chave
 * cadastrada em /ai/credentials; a ordem é a prioridade do failover.
 */

export interface AiConnection {
  id: string;
  credentialId: string;
  provider: string;
  nome: string | null;
  model: string;
  keyLast4: string;
  status: "ativa" | "invalida";
  priority: number;
}

export interface SetConnectionInput {
  credentialId: string;
  model: string;
}

export async function listAiConnections(): Promise<AiConnection[]> {
  const { data } = await axios.get<AiConnection[]>("/ai/connections");
  return data ?? [];
}

export async function addAiConnection(
  input: SetConnectionInput,
): Promise<AiConnection> {
  const { data } = await axios.put<AiConnection>("/ai/connections", input);
  return data;
}

export async function reorderAiConnections(
  ids: string[],
): Promise<AiConnection[]> {
  const { data } = await axios.put<AiConnection[]>("/ai/connections/order", {
    ids,
  });
  return data ?? [];
}

export async function removeAiConnection(id: string): Promise<void> {
  await axios.delete(`/ai/connections/${id}`);
}
