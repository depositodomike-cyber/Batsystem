/**
 * Setores de atuação oferecidos no onboarding. Usados para personalizar a
 * experiência inicial (templates, benchmarks) na Fase 2. Por ora são apenas
 * metadados; o código escolhido é salvo em `Empresa.setor`.
 */

export interface Setor {
  code: string;
  nome: string;
}

export const SETORES: Setor[] = [
  { code: "tecnologia", nome: "Tecnologia / SaaS" },
  { code: "servicos", nome: "Serviços" },
  { code: "varejo", nome: "Varejo / E-commerce" },
  { code: "industria", nome: "Indústria" },
  { code: "saude", nome: "Saúde" },
  { code: "educacao", nome: "Educação" },
  { code: "financeiro", nome: "Serviços financeiros" },
  { code: "agro", nome: "Agronegócio" },
  { code: "construcao", nome: "Construção / Imobiliário" },
  { code: "logistica", nome: "Logística / Transporte" },
  { code: "marketing", nome: "Marketing / Agência" },
  { code: "outro", nome: "Outro" },
];

export function nomeSetor(code: string | undefined): string {
  if (!code) return "";
  return SETORES.find((s) => s.code === code)?.nome ?? code;
}
