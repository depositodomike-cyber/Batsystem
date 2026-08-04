import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar Dashboard (IA) — chama o backend ts/api (POST /ai/dashboard). Geração
// direta com refino iterativo (ajuste sobre a versão anterior). Devolve uma
// página HTML autônoma (KPIs, gráficos, tabelas) pronta para preview/download.

export interface Dashboard {
  titulo: string;
  descricao: string;
  html: string;
  /**
   * Bloco "## 🔗 Conexões no Vault" ([[wikilinks]] para outros assuntos da
   * Memória). Entra na nota ao salvar na Memória, fora do HTML do painel.
   */
  conexoes: string;
}

export interface DashboardReq {
  tema: string;
  dados?: string;
  contexto?: string;
  fontes?: string[];
  referencia?: string;
  ajuste?: string;
  anterior?: Dashboard | null;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export async function gerarDashboardApi(req: DashboardReq): Promise<Dashboard> {
  const { data } = await axios.post<Dashboard>("/ai/dashboard", req);
  return data;
}
