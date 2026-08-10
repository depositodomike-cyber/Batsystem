import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar Carrossel (IA) — chama o backend ts/api (POST /ai/carrossel). Devolve o
// roteiro (cards + legenda + hashtags), editável no cliente. Refino iterativo.
// Portado do beculture/Confi.

export interface CardItem {
  titulo: string;
  texto: string;
}
export interface Carrossel {
  titulo: string;
  cards: CardItem[];
  legenda: string;
  hashtags: string[];
  /**
   * Bloco "## 🔗 Conexões no Vault" ([[wikilinks]] para outros assuntos da
   * Memória). Entra na nota ao salvar no Repositório, fora do roteiro editável.
   */
  conexoes: string;
}

export interface CarrosselReq {
  tema: string;
  contexto?: string;
  estilo?: string;
  nPaginas?: number;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Carrossel | null;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export async function gerarCarrosselApi(req: CarrosselReq): Promise<Carrossel> {
  const { data } = await axios.post<Carrossel>("/ai/carrossel", req);
  return data;
}
