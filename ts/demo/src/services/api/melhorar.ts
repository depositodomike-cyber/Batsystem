import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Melhorar texto (IA) — chama o backend ts/api (POST /ai/melhorar). Reescreve o
// texto mais claro/forte sem mudar o sentido. Portado do beculture/Confi.

export interface Melhorado {
  texto: string;
  resumo: string;
  /**
   * Bloco "## 🔗 Conexões no Vault" ([[wikilinks]] para outros assuntos da
   * Memória). Fica fora do texto melhorado — é anexado só à nota da Memória,
   * para não voltar ao textarea nem à área de transferência.
   */
  conexoes: string;
}

export async function melhorarTextoApi(req: {
  texto: string;
  instrucoes?: string;
  /** Design system da marca ativa (AI Studio) — guia o tom da reescrita. */
  design?: DesignSystem;
}): Promise<Melhorado> {
  const { data } = await axios.post<Melhorado>("/ai/melhorar", req);
  return data;
}
