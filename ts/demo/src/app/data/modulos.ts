/**
 * Módulos do produto. Cada módulo é contratado no seu próprio plano e
 * quantidade (modelo da calculadora). Os ícones são mapeados na UI
 * (mantemos este arquivo livre de JSX).
 *
 * `unidade` define a base de cobrança/quantidade:
 * - "usuarios"  → IA, Performance, Learning, Project Management (por usuário)
 * - "posicoes"  → Hiring (preço por posição/vaga)
 */

import type { PlanoCode } from "./planos";

export type ModuloCode =
  | "ia_pessoal"
  | "performance"
  | "learning"
  | "recrutamento"
  | "projetos";

export type Unidade = "usuarios" | "posicoes";

export interface Modulo {
  code: ModuloCode;
  nome: string;
  descricao: string;
  unidade: Unidade;
  /** Planos disponíveis para o módulo. Ausente = todos os planos. */
  planos?: PlanoCode[];
}

export const MODULOS: Modulo[] = [
  {
    code: "ia_pessoal",
    nome: "IA",
    descricao: "Assistente de IA individual",
    unidade: "usuarios",
    planos: ["profissional", "corporativo"],
  },
  {
    code: "performance",
    nome: "Performance",
    descricao: "Avaliações, OKRs e 1:1s",
    unidade: "usuarios",
  },
  {
    code: "learning",
    nome: "Learning",
    descricao: "Trilhas de aprendizagem e LMS",
    unidade: "usuarios",
  },
  {
    code: "recrutamento",
    nome: "Hiring",
    descricao: "Vagas, triagem e pipeline",
    unidade: "posicoes",
  },
  {
    code: "projetos",
    nome: "Project Management",
    descricao: "Gestão de projetos e tarefas",
    unidade: "usuarios",
  },
];

export const MODULO_CODES: ModuloCode[] = MODULOS.map((m) => m.code);

export function getModulo(code: string): Modulo | undefined {
  return MODULOS.find((m) => m.code === code);
}

export function nomeModulo(code: string): string {
  return getModulo(code)?.nome ?? code;
}

export function unidadeDoModulo(code: string): Unidade {
  return getModulo(code)?.unidade ?? "usuarios";
}

/** Unidade de um conjunto de módulos (Hiring/posições é exclusivo). */
export function unidadeDosModulos(codes: string[]): Unidade {
  return codes.some((c) => unidadeDoModulo(c) === "posicoes")
    ? "posicoes"
    : "usuarios";
}

/** Rótulo legível da unidade (singular/plural). */
export function unidadeLabel(unidade: Unidade, plural = true): string {
  if (unidade === "posicoes") return plural ? "posições" : "posição";
  return plural ? "usuários" : "usuário";
}

/** Planos disponíveis para um módulo (ausência de restrição = todos). */
export function planosDoModulo(code: ModuloCode): PlanoCode[] {
  return (
    getModulo(code)?.planos ?? ["basico", "profissional", "corporativo"]
  );
}
