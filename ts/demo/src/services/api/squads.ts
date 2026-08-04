import axios from "@/utils/axios";

/**
 * Cliente do catálogo de squads (backend ts/api → tabelas Squad/SquadAgent/…).
 * Substitui o antigo `@/app/data/squadDetails.ts` estático. O JWT é injetado
 * automaticamente pelo axios (utils/jwt.ts → setSession).
 *
 * `GET /squads` é consumido pelo SquadsProvider (catálogo na sidebar/rotas) e
 * `GET /squads/:id` pelo SquadDetail (detalhe do squad selecionado).
 */

export interface SquadAgent {
  /** Id estável do agente, ex.: "bp.com-interna.simon-sinek". */
  id: string;
  /** Papel do agente no squad, ex.: "Comunicação Inspiradora". */
  position: string;
  /** Referência humana personificada, ex.: "Simon Sinek". */
  reference: string;
  /** "Quem é" — frase curta. */
  who: string;
  /** "Contribuição" — o que entrega ao squad. */
  contribution: string;
}

export interface SquadDetail {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  /** "Quando utilizar". */
  description: string;
  /** Perguntas iniciais sugeridas. */
  starterQuestions: string[];
  /** Ações executáveis sugeridas (tarefas que um agente de IA pode realizar). */
  starterActions: string[];
  agents: SquadAgent[];
}

export interface SquadCatalogItem {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  description: string;
}

/** GET /squads → catálogo (leve, sem agentes/prompts). */
export async function fetchSquadCatalogApi(): Promise<SquadCatalogItem[]> {
  const { data } = await axios.get<SquadCatalogItem[]>("/squads");
  return data;
}

/** GET /squads/:id → detalhe completo (agentes + perguntas). */
export async function fetchSquadDetailApi(id: string): Promise<SquadDetail> {
  const { data } = await axios.get<SquadDetail>(
    `/squads/${encodeURIComponent(id)}`,
  );
  return data;
}
