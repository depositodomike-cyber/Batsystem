import axios from "@/utils/axios";

// ----------------------------------------------------------------------
// Cliente da API de Conversas (backend NestJS: /conversas, escopo por
// usuário+empresa). As mensagens são gravadas pelo fluxo de chat
// (POST /ai/chat/stream); aqui só listamos, abrimos e excluímos o histórico.
// `date` vem em ISO 8601 — a UI formata para exibição.
// ----------------------------------------------------------------------

export interface ConversaMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  date: string;
}

export interface ConversaListItem {
  id: string;
  squadId: string;
  agentId: string | null;
  title: string;
  /** Prévia: conteúdo da última mensagem. */
  preview: string;
  date: string;
}

export interface ConversaDetail {
  id: string;
  squadId: string;
  agentId: string | null;
  title: string;
  date: string;
  messages: ConversaMessage[];
}

/** GET /conversas — histórico do usuário na empresa. */
export async function fetchConversasApi(): Promise<ConversaListItem[]> {
  const { data } = await axios.get<ConversaListItem[]>("/conversas");
  return data;
}

/** GET /conversas/:id — uma conversa com todas as mensagens. */
export async function fetchConversaApi(id: string): Promise<ConversaDetail> {
  const { data } = await axios.get<ConversaDetail>(
    `/conversas/${encodeURIComponent(id)}`,
  );
  return data;
}

/** DELETE /conversas/:id — remove a conversa. */
export async function deleteConversaApi(id: string): Promise<void> {
  await axios.delete(`/conversas/${encodeURIComponent(id)}`);
}
