/**
 * Conteúdo (funcionalidades) incluído em cada módulo por plano.
 * Origem: calculadora de preço (Site/calculadora.html) — composição por camadas:
 *
 *   Basic        = core do módulo + funcionalidades comuns
 *   Profissional = Basic + IA (AI Memory, AI Squads, Conectores)
 *   Expert       = Profissional + IA avançada (AI Studio, AI Meet)
 *
 * O módulo IA (`ia_pessoal`) só existe em Profissional/Expert e contém apenas
 * as camadas de IA.
 */
import type { ModuloCode } from "./modulos";
import type { PlanoCode } from "./planos";

/** Funcionalidades comuns a todos os módulos (exceto Hiring e IA). */
const COMUNS = [
  "Feed",
  "Comunidades",
  "Pesquisa",
  "Eventos",
  "Documentos",
  "Organograma",
  "Calendário",
  "FAQ",
  "Chat",
  "Gestão de Tarefas",
];

/** Core de cada módulo. */
const CORE: Partial<Record<ModuloCode, string[]>> = {
  performance: [
    "Auto Avaliação",
    "Avaliação 180º",
    "Avaliação 360º",
    "PDI",
    "One on One",
    "9-box",
    "Metas",
    "OKR's",
    "Dashboards",
  ],
  learning: [
    "Universidade Corporativa",
    "Trilhas",
    "Avaliação",
    "Fóruns",
    "Certificados",
    "Tarefas",
    "Dashboards",
  ],
  projetos: [
    "Squads",
    "Projetos",
    "Alocação de horas",
    "Alocação de custos",
    "Gestão de habilidade e papéis",
    "Tarefas",
    "Dashboards",
  ],
  recrutamento: [
    "Criação de vaga",
    "Multiposting +100 canais",
    "Portal de carreiras",
    "Triagem com IA",
    "Scorecards",
    "Testes & avaliações",
    "Banco de talentos vivo",
    "Agenda de entrevistas",
    "Dashboards",
    "WhatsApp integrado",
  ],
};

/** Camada de IA incluída a partir do Profissional. */
const IA_PRO = ["AI Memory", "AI Squads", "Conectores"];

/** Camada de IA avançada, exclusiva do Expert. */
const IA_EXPERT = ["AI Studio", "AI Meet"];

export const MODULO_CONTEUDO: Record<
  ModuloCode,
  Partial<Record<PlanoCode, string[]>>
> = Object.fromEntries(
  (Object.keys(CORE) as ModuloCode[]).map((code) => {
    const basico = [...CORE[code]!, ...COMUNS];
    const profissional = [...basico, ...IA_PRO];
    return [
      code,
      { basico, profissional, corporativo: [...profissional, ...IA_EXPERT] },
    ];
  }),
) as Record<ModuloCode, Partial<Record<PlanoCode, string[]>>>;

MODULO_CONTEUDO.ia_pessoal = {
  profissional: [...IA_PRO],
  corporativo: [...IA_PRO, ...IA_EXPERT],
};

/** Funcionalidades incluídas em um módulo para um plano. */
export function conteudoDoModulo(
  modulo: ModuloCode,
  plano: PlanoCode,
): string[] {
  return MODULO_CONTEUDO[modulo]?.[plano] ?? [];
}
