import axios from "@/utils/axios";
import type {
  Insight,
  InsightDetalhe,
  InsightFeedback,
  InsightFeedbackMotivo,
} from "@/app/data/insights";

// Insights (IA) — chama o backend ts/api. Os insights são gerados a partir do
// material (ata/resumo de reunião) e persistidos por empresa; a página de
// Insights os lê daqui em vez de uma lista estática.

interface InsightsResponse {
  insights: Insight[];
}

/** Lista os insights da empresa (mais recentes primeiro). */
export async function listarInsightsApi(): Promise<Insight[]> {
  const { data } = await axios.get<InsightsResponse>("/ai/insights");
  return data.insights;
}

/**
 * Insights que o usuário ainda não viu — conteúdo do sino de notificações.
 * `total` conta todos; `insights` traz só os mais recentes.
 */
export async function listarInsightsNaoLidosApi(): Promise<{
  insights: Insight[];
  total: number;
}> {
  const { data } = await axios.get<InsightsResponse & { total: number }>(
    "/ai/insights/nao-lidos",
  );
  return data;
}

/** Marca um insight como visto pelo usuário (sai do sino). */
export async function marcarInsightLidoApi(id: string): Promise<void> {
  await axios.post(`/ai/insights/${encodeURIComponent(id)}/lido`);
}

/** Marca como vistos todos os insights não lidos do usuário. */
export async function marcarTodosInsightsLidosApi(): Promise<void> {
  await axios.post("/ai/insights/lidos");
}

/** Um insight com o conteúdo completo (análise, evidências, fonte). */
export async function buscarInsightApi(id: string): Promise<InsightDetalhe> {
  const { data } = await axios.get<{ insight: InsightDetalhe }>(
    `/ai/insights/${encodeURIComponent(id)}`,
  );
  return data.insight;
}

/** "Este insight foi útil?" — grava (ou troca) o 👍/👎 do usuário. */
export async function salvarFeedbackInsightApi(
  id: string,
  feedback: {
    util: boolean;
    motivo?: InsightFeedbackMotivo;
    comentario?: string;
  },
): Promise<InsightFeedback> {
  const { data } = await axios.put<{ feedback: InsightFeedback }>(
    `/ai/insights/${encodeURIComponent(id)}/feedback`,
    feedback,
  );
  return data.feedback;
}

/** Desfaz o 👍/👎 do usuário. */
export async function removerFeedbackInsightApi(id: string): Promise<void> {
  await axios.delete(`/ai/insights/${encodeURIComponent(id)}/feedback`);
}

export interface GerarInsightsParams {
  /** Título do material (ata/resumo/documento). */
  titulo?: string;
  /** Conteúdo do material a partir do qual os insights são gerados. */
  conteudo: string;
  /** Rótulo de origem (ex.: "Áudio", "Transcrição", "Documento"). */
  origem?: string;
  /** Memória de origem, quando houver. */
  memoriaId?: string;
}

/**
 * Gera insights a partir de um material via IA e os PERSISTE. Retorna os
 * insights criados (já no formato da página de Insights).
 */
export async function gerarInsightsApi(
  p: GerarInsightsParams,
): Promise<Insight[]> {
  const { data } = await axios.post<InsightsResponse>("/ai/insights/gerar", {
    ...(p.titulo ? { titulo: p.titulo } : {}),
    conteudo: p.conteudo,
    ...(p.origem ? { origem: p.origem } : {}),
    ...(p.memoriaId ? { memoriaId: p.memoriaId } : {}),
  });
  return data.insights;
}
