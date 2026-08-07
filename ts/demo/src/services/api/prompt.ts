import axios from "@/utils/axios";

// Prompt "Pergunte ao seu Contexto" — chama o backend ts/api (POST /ai/prompt),
// portado do beculture/Confi. Três modos: Memória (vault), Web e Auto.

export type ModoBusca = "vault" | "web" | "auto";

/** Fonte da resposta: título de item do Contexto, ou página web citada. */
export type Fonte = string | { titulo: string; url: string };

export interface HistoricoTurno {
  pergunta: string;
  resposta: string;
}

export interface PromptResposta {
  tipo: "resposta";
  resposta: string;
  fontes: Fonte[];
  origem: "vault" | "web";
}

export interface PromptParams {
  texto: string;
  modo: ModoBusca;
  /** Anexo de texto (ignorado no modo Web, igual ao Confi). */
  arquivo?: File | null;
  /** Notas/Insights/To-do's coletados no cliente para cruzamento. */
  referencia?: string;
  /** Turnos anteriores (continuação de conversa). */
  historico?: HistoricoTurno[];
}

export async function perguntarPromptApi(p: PromptParams): Promise<PromptResposta> {
  const usarAnexo = !!p.arquivo && p.modo !== "web";

  if (usarAnexo) {
    const fd = new FormData();
    fd.append("texto", p.texto);
    fd.append("modo", p.modo);
    if (p.arquivo) fd.append("arquivo", p.arquivo);
    if (p.referencia) fd.append("referencia", p.referencia);
    if (p.historico?.length) fd.append("historico", JSON.stringify(p.historico));
    const { data } = await axios.post<PromptResposta>("/ai/prompt", fd);
    return data;
  }

  const { data } = await axios.post<PromptResposta>("/ai/prompt", {
    texto: p.texto,
    modo: p.modo,
    ...(p.referencia ? { referencia: p.referencia } : {}),
    ...(p.historico?.length ? { historico: JSON.stringify(p.historico) } : {}),
  });
  return data;
}

/** Rótulo humano de uma fonte (para o chip). */
export function fonteLabel(f: Fonte): string {
  return typeof f === "string" ? f : f.titulo || f.url;
}

/** URL de uma fonte web (null para fontes do Contexto). */
export function fonteUrl(f: Fonte): string | null {
  return typeof f === "string" ? null : f.url || null;
}
