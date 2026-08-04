import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Análise de conteúdo (IA) — chama o backend ts/api (POST /ai/analise), que
// extrai o texto do arquivo/link, cruza com as fontes e roda o framework de
// 17 seções no Claude. Portado do beculture/Confi.

export interface AnaliseResult {
  titulo: string;
  analise: string;
  origem: string;
}

export interface AnaliseParams {
  arquivo?: File | null;
  link?: string;
  objetivo: string;
  descricao?: string;
  vies: string;
  fontes: string[];
  secoes: string[];
  /** Texto de Notas/Insights/To-do's coletado no cliente para cruzamento. */
  referencia?: string;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export async function analisarConteudoApi(p: AnaliseParams): Promise<AnaliseResult> {
  const fd = new FormData();
  if (p.arquivo) fd.append("arquivo", p.arquivo);
  if (p.link) fd.append("link", p.link);
  fd.append("objetivo", p.objetivo);
  if (p.descricao) fd.append("descricao", p.descricao);
  fd.append("vies", p.vies);
  fd.append("fontes", JSON.stringify(p.fontes));
  fd.append("secoes", JSON.stringify(p.secoes));
  if (p.referencia) fd.append("referencia", p.referencia);
  if (p.design) fd.append("design", JSON.stringify(p.design));
  const { data } = await axios.post<AnaliseResult>("/ai/analise", fd);
  return data;
}
