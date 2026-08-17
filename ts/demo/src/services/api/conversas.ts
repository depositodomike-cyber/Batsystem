import axios from "@/utils/axios";

import type { Fonte, ModoBusca } from "@/services/api/prompt";

export type ConversaOrigem = "prompt" | "squad";

export interface ConversaMessageMeta {
  fontes?: Fonte[];
  origem?: "vault" | "web";
}

export interface ConversaMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  date: string;
  meta?: ConversaMessageMeta | null;
}

export interface ConversaListItem {
  id: string;
  origem: ConversaOrigem;
  squadId: string | null;
  agentId: string | null;
  modo: ModoBusca | string | null;
  repositorioId: string | null;
  title: string;
  preview: string;
  date: string;
}

export interface ConversaDetail {
  id: string;
  origem: ConversaOrigem;
  squadId: string | null;
  agentId: string | null;
  modo: ModoBusca | string | null;
  repositorioId: string | null;
  title: string;
  date: string;
  messages: ConversaMessage[];
}

export async function fetchConversasApi(opts?: {
  origem?: ConversaOrigem;
  q?: string;
  limit?: number;
  repositorioId?: string;
}): Promise<ConversaListItem[]> {
  const { data } = await axios.get<ConversaListItem[]>("/conversas", {
    params: {
      ...(opts?.origem ? { origem: opts.origem } : {}),
      ...(opts?.q ? { q: opts.q } : {}),
      ...(opts?.limit ? { limit: opts.limit } : {}),
      ...(opts?.repositorioId ? { repositorioId: opts.repositorioId } : {}),
    },
  });
  return data ?? [];
}

export async function fetchConversaApi(
  id: string,
  opts?: { repositorioId?: string },
): Promise<ConversaDetail> {
  const { data } = await axios.get<ConversaDetail>(
    `/conversas/${encodeURIComponent(id)}`,
    {
      params: opts?.repositorioId
        ? { repositorioId: opts.repositorioId }
        : undefined,
    },
  );
  return data;
}

export async function renameConversaApi(
  id: string,
  titulo: string,
): Promise<ConversaListItem> {
  const { data } = await axios.patch<ConversaListItem>(
    `/conversas/${encodeURIComponent(id)}`,
    { titulo },
  );
  return data;
}

export async function deleteConversaApi(id: string): Promise<void> {
  await axios.delete(`/conversas/${encodeURIComponent(id)}`);
}
