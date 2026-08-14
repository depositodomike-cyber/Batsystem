import axios from "@/utils/axios";

/**
 * Fila de modelos de mídia (Imagem e Vídeo). A chave fica em
 * /ai/credentials; aqui só o modelo e a ordem de prioridade.
 */

export type AiMediaKind = "image" | "video";

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

export async function listAiMediaConnections(
  kind: AiMediaKind,
): Promise<AiConnection[]> {
  const { data } = await axios.get<AiConnection[]>(
    `/ai/media/${kind}/connections`,
  );
  return data ?? [];
}

export async function addAiMediaConnection(
  kind: AiMediaKind,
  input: SetConnectionInput,
): Promise<AiConnection> {
  const { data } = await axios.put<AiConnection>(
    `/ai/media/${kind}/connections`,
    input,
  );
  return data;
}

export async function reorderAiMediaConnections(
  kind: AiMediaKind,
  ids: string[],
): Promise<AiConnection[]> {
  const { data } = await axios.put<AiConnection[]>(
    `/ai/media/${kind}/connections/order`,
    { ids },
  );
  return data ?? [];
}

export async function removeAiMediaConnection(
  kind: AiMediaKind,
  id: string,
): Promise<void> {
  await axios.delete(`/ai/media/${kind}/connections/${id}`);
}
