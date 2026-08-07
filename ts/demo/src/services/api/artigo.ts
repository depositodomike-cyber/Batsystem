import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar artigo (IA) — chama o backend ts/api (POST /ai/artigo). Geração direta
// com refino iterativo (ajuste sobre a versão anterior). Portado do beculture/Confi.

export interface Artigo {
  titulo: string;
  subtitulo: string;
  conteudo: string;
  /**
   * Bloco "## 🔗 Conexões no Vault" ([[wikilinks]] para outros assuntos da
   * Memória). Vem separado do artigo: entra na nota ao salvar no Contexto (e no
   * .md baixado), sem poluir o texto que o usuário copia para publicar.
   */
  conexoes: string;
}

export interface ArtigoReq {
  tema: string;
  contexto?: string;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Artigo | null;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export async function gerarArtigoApi(req: ArtigoReq): Promise<Artigo> {
  const { data } = await axios.post<Artigo>("/ai/artigo", req);
  return data;
}
