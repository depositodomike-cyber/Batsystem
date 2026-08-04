import axios from "@/utils/axios";
import type { Insight } from "@/app/data/insights";

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
