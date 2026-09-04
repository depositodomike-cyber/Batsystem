/**
 * Tabela código → rótulo do dado LEGADO de cargo.
 *
 * Mesma natureza de `areas.ts`: Cargos viraram entidades administráveis, este
 * arquivo não alimenta mais nenhum formulário e existe só para traduzir os
 * códigos que ficaram gravados em `membros.cargo`. Único consumidor legítimo:
 * `rotuloCargo()` em `pages/ceo/membros-status.ts`.
 */

export interface Cargo {
  code: string;
  nome: string;
}

export const CARGOS: Cargo[] = [
  { code: "diretor", nome: "Diretor(a)" },
  { code: "gerente", nome: "Gerente" },
  { code: "coordenador", nome: "Coordenador(a)" },
  { code: "especialista", nome: "Especialista" },
  { code: "analista", nome: "Analista" },
  { code: "assistente", nome: "Assistente" },
  { code: "designer", nome: "Product Designer" },
  { code: "engenheiro", nome: "Engenheiro(a) de Software" },
  { code: "business-partner", nome: "Business Partner" },
  { code: "estagiario", nome: "Estagiário(a)" },
];

/** Rótulo de um código legado. Código desconhecido volta como está. */
export function nomeCargo(code: string | null | undefined): string {
  if (!code) return "";
  return CARGOS.find((c) => c.code === code)?.nome ?? code;
}
