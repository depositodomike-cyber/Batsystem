/**
 * Tabela código → rótulo do dado LEGADO de área.
 *
 * Áreas viraram entidades administráveis por organização (ver
 * `@/services/api/estrutura`), e é de lá que sai a lista do seletor. Este
 * arquivo deixou de alimentar qualquer formulário: sobrevive só para traduzir
 * os códigos que ficaram gravados em `membros.area` antes da mudança.
 *
 * Não houve backfill de propósito — nenhum registro existente foi tocado —,
 * então esses códigos continuam no banco até que cada membro seja
 * reconfigurado. Enquanto houver um só, este arquivo precisa existir.
 *
 * Ninguém deve importar `AREAS` para montar opções: o único consumidor
 * legítimo é `rotuloArea()` em `pages/ceo/membros-status.ts`.
 */

export interface Area {
  code: string;
  nome: string;
}

export const AREAS: Area[] = [
  { code: "produto", nome: "Produto" },
  { code: "tecnologia", nome: "Tecnologia" },
  { code: "design", nome: "Design" },
  { code: "marketing", nome: "Marketing" },
  { code: "comercial", nome: "Comercial" },
  { code: "customer-success", nome: "Customer Success" },
  { code: "operacoes", nome: "Operações" },
  { code: "financeiro", nome: "Financeiro" },
  { code: "pessoas", nome: "Pessoas & Cultura" },
  { code: "juridico", nome: "Jurídico" },
  { code: "dados", nome: "Dados" },
];

/**
 * Rótulo de um código legado. Código desconhecido volta como está — é o que
 * cobre uma área digitada à mão em algum momento.
 */
export function nomeArea(code: string | null | undefined): string {
  if (!code) return "";
  return AREAS.find((a) => a.code === code)?.nome ?? code;
}
