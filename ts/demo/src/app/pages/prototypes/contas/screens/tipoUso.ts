/**
 * Intenção de uso escolhida no Step 2.
 *
 * Não é um tipo técnico de organização armazenado no estado: mapeia para o
 * pagador (`pf` = pessoal/B2C, `pj` = empresa/B2B) no submit. Facilita
 * acrescentar novas intenções sem mudar a forma do reducer.
 */
export type TipoUso = "personal" | "organization";

export const TIPO_USO_OPTIONS = [
  {
    value: "personal" as const,
    label: "Uso pessoal",
    description: "Apenas para meu uso.",
  },
  {
    value: "organization" as const,
    label: "Empresa ou equipe",
    description: "Para colaborar com outras pessoas.",
  },
] as const;
