export type RequisitoSenhaId =
  | "comprimento"
  | "simbolo"
  | "numero"
  | "maiuscula"
  | "minuscula";

export interface RequisitoSenha {
  id: RequisitoSenhaId;
  label: string;
  test: (senha: string) => boolean;
}

export const REQUISITOS_SENHA: RequisitoSenha[] = [
  {
    id: "comprimento",
    label: "Mínimo de 8 caracteres",
    test: (senha) => senha.length >= 8,
  },
  {
    id: "simbolo",
    label: "Símbolo",
    test: (senha) => /[^A-Za-z0-9]/.test(senha),
  },
  {
    id: "numero",
    label: "Número",
    test: (senha) => /[0-9]/.test(senha),
  },
  {
    id: "maiuscula",
    label: "Letra maiúscula",
    test: (senha) => /[A-Z]/.test(senha),
  },
  {
    id: "minuscula",
    label: "Letra minúscula",
    test: (senha) => /[a-z]/.test(senha),
  },
];

export function requisitosSenhaAtendidos(senha: string): boolean {
  return REQUISITOS_SENHA.every((requisito) => requisito.test(senha));
}

export function avaliarRequisitosSenha(senha: string) {
  return REQUISITOS_SENHA.map((requisito) => ({
    ...requisito,
    atendido: requisito.test(senha),
  }));
}
