import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar apresentação (IA) — fluxo de 2 etapas contra o backend ts/api:
//  1) POST /ai/apresentacao/roteiro → roteiro editável (JSON)
//  2) POST /ai/apresentacao/gerar   → .pptx (download) ou HTML (slides/book)
// Portado do beculture/Confi.

export type Formato = "pptx" | "slides-html" | "book-html";

export interface SlideItem {
  titulo: string;
  bullets: string[];
  notas?: string;
}
export interface CapituloItem {
  titulo: string;
  paragrafos: string[];
}
export interface Roteiro {
  titulo: string;
  subtitulo: string;
  slides?: SlideItem[];
  capitulos?: CapituloItem[];
  /**
   * Bloco "## 🔗 Conexões no Vault" ([[wikilinks]] para outros assuntos da
   * Memória). Entra na nota ao salvar na Memória; não vai para o .pptx/.html.
   */
  conexoes: string;
}

export interface RoteiroReq {
  tema: string;
  formato: Formato;
  nSlides?: number;
  publico?: string;
  objetivo?: string;
  tom?: string;
  idioma?: string;
  fontes?: string[];
  referencia?: string;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

/** Etapa 1 — gera o roteiro editável. */
export async function gerarRoteiroApi(
  req: RoteiroReq,
): Promise<{ formato: Formato; roteiro: Roteiro }> {
  const { data } = await axios.post<{ formato: Formato; roteiro: Roteiro }>(
    "/ai/apresentacao/roteiro",
    req,
  );
  return data;
}

/** Etapa 2 (pptx) — devolve o arquivo .pptx como Blob para download. */
export async function gerarPptxApi(roteiro: Roteiro, design?: DesignSystem): Promise<Blob> {
  const { data } = await axios.post<Blob>(
    "/ai/apresentacao/gerar",
    { formato: "pptx", roteiro, design },
    { responseType: "blob" },
  );
  return data;
}

/** Etapa 2 (HTML) — devolve o HTML autônomo (slides-html ou book-html). */
export async function gerarHtmlApi(
  formato: Formato,
  roteiro: Roteiro,
  design?: DesignSystem,
): Promise<string> {
  const { data } = await axios.post<{ html: string }>("/ai/apresentacao/gerar", {
    formato,
    roteiro,
    design,
  });
  return data.html;
}
