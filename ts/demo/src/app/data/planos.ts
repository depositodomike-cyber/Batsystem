/**
 * Planos do beculture.ai. A PRECIFICAÇÃO vive em `precificacao.ts` (tabela por
 * módulo × contrato × plano × faixa de quantidade). Aqui ficam só os metadados
 * de exibição (nome, descrição, destaque).
 */

export type PlanoCode = "basico" | "profissional" | "corporativo";

export interface Plano {
  code: PlanoCode;
  nome: string;
  /** Resumo curto do público-alvo / proposta. */
  descricao: string;
  /** Principais recursos. */
  destaques: string[];
  /** Plano em evidência ("Mais escolhido"). */
  emDestaque: boolean;
}

export const PLANOS: Record<PlanoCode, Plano> = {
  basico: {
    code: "basico",
    nome: "Basic",
    descricao: "Para equipes que precisam apenas da funcionalidade do módulo selecionado.",
    destaques: [
      "Recrutamento até 5 vagas/mês",
      "Performance & OKRs básico",
      "Pesquisa de clima trimestral",
      "Dashboard unificado",
      "Suporte por chat em horário comercial",
    ],
    emDestaque: false,
  },
  profissional: {
    code: "profissional",
    nome: "Profissional",
    descricao: "Para equipes que querem o módulo selecionado aliado a uma comunicação excelente.",
    destaques: [
      "Recrutamento ilimitado",
      "Performance & OKRs completo",
      "Clima contínuo + IA preditiva de turnover",
      "Triagem automática e LMS personalizado",
      "Suporte prioritário + CSM dedicado",
    ],
    emDestaque: true,
  },
  corporativo: {
    code: "corporativo",
    nome: "Expert",
    descricao: "Para equipes que buscam excelência no uso de soluções e IA.",
    destaques: [
      "Tudo do Profissional",
      "SSO/SAML e API dedicada",
      "Multi-empresa e LGPD avançado",
      "SLA 99,9% e suporte 24/7",
      "Onboarding dedicado",
    ],
    emDestaque: false,
  },
};

export const PLANOS_LIST: Plano[] = [
  PLANOS.basico,
  PLANOS.profissional,
  PLANOS.corporativo,
];

/** Duração do teste grátis, em dias (sem cartão). */
export const TRIAL_DIAS = 14;

/** Normaliza um valor vindo da URL (?plano=) para um PlanoCode válido. */
export function parsePlanoCode(raw: string | null | undefined): PlanoCode {
  const value = (raw ?? "").toLowerCase().trim();
  if (
    value === "basico" ||
    value === "profissional" ||
    value === "corporativo"
  ) {
    return value;
  }
  // Fallback para o plano em destaque quando ausente/inválido.
  return "profissional";
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
