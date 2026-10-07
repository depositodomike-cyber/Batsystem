import axios from "@/utils/axios";

import type {
  AgenteDaResposta,
  ArquivoConversa,
  Fonte,
  MencaoAgente,
  ModoBusca,
} from "@/services/api/prompt";

export type ConversaOrigem = "prompt" | "squad";

export interface ConversaMessageMeta {
  fontes?: Fonte[];
  origem?: "vault" | "web";
  /** Agente que produziu a resposta (conversas do Assistente). */
  agente?: AgenteDaResposta | null;
  /** Arquivos gerados nesta resposta. */
  arquivos?: ArquivoConversa[];
  /** Agentes @mencionados (mensagens do usuário). */
  mencoes?: MencaoAgente[];
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
  /** Agentes que já responderam na conversa (ids). */
  agenteIds?: string[];
  /**
   * Os mesmos agentes com o nome gravado nas mensagens, na ordem em que
   * participaram — vale também para agentes personalizados já excluídos.
   */
  agentes?: AgenteDaResposta[];
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

/** Troca ou remove (`null`) o agente ativo de uma conversa do Assistente. */
export async function definirAgenteConversaApi(
  id: string,
  agenteId: string | null,
): Promise<void> {
  await axios.patch(`/conversas/${encodeURIComponent(id)}/agente`, {
    agenteId,
  });
}

/** Marca um arquivo da conversa como salvo no Repositório. */
export async function marcarArquivoSalvoApi(p: {
  conversaId: string;
  mensagemId: string;
  arquivoId: string;
  repositorioDocumentoId: string;
}): Promise<void> {
  await axios.patch(
    `/conversas/${encodeURIComponent(p.conversaId)}/mensagens/${encodeURIComponent(p.mensagemId)}/arquivos/${encodeURIComponent(p.arquivoId)}`,
    { repositorioDocumentoId: p.repositorioDocumentoId },
  );
}

export async function deleteConversaApi(id: string): Promise<void> {
  await axios.delete(`/conversas/${encodeURIComponent(id)}`);
}
