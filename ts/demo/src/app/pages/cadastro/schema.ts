import * as Yup from "yup";

import { isValidCnpj } from "@/utils/cnpj";
import { isValidTelefone } from "@/utils/telefone";

export type TipoPessoa = "pj" | "pf";

export interface CadastroFormValues {
  razaoSocial: string;
  documento: string;
  nome: string;
  email: string;
  telefone: string;
  setor: string;
  nomeFantasia: string;
  senha: string;
  confirmarSenha: string;
  aceite: boolean;
}

/** Contexto passado ao resolver para validar conforme PJ/PF. */
export interface CadastroSchemaContext {
  tipoPessoa: TipoPessoa;
}

export const schema: Yup.ObjectSchema<CadastroFormValues> = Yup.object().shape({
  // Só obrigatório para Pessoa Jurídica (empresa).
  razaoSocial: Yup.string()
    .default("")
    .when("$tipoPessoa", {
      is: "pj",
      then: (s) => s.trim().required("Informe a razão social da empresa."),
      otherwise: (s) => s.optional().default(""),
    }),
  // Só obrigatório para Pessoa Jurídica (empresa); PF não exibe o campo.
  documento: Yup.string()
    .trim()
    .default("")
    .when("$tipoPessoa", {
      is: "pj",
      then: (s) =>
        s
          .required("Informe o CNPJ.")
          .test("cnpj-valido", "CNPJ inválido.", (value) =>
            isValidCnpj(value ?? ""),
          ),
      otherwise: (s) => s.optional().default(""),
    }),
  nome: Yup.string().trim().required("Informe o nome."),
  email: Yup.string()
    .trim()
    .email("E-mail inválido.")
    .required("Informe o e-mail."),
  telefone: Yup.string()
    .trim()
    .required("Informe o telefone.")
    .test("telefone-valido", "Telefone inválido.", (value) =>
      isValidTelefone(value ?? ""),
    ),
  setor: Yup.string().optional().default(""),
  // Só faz sentido para Pessoa Jurídica; PF não exibe o campo.
  nomeFantasia: Yup.string().optional().default(""),
  senha: Yup.string()
    .required("Crie uma senha.")
    .min(8, "Mínimo de 8 caracteres.")
    .matches(/[A-Za-z]/, "Inclua ao menos uma letra.")
    .matches(/[0-9]/, "Inclua ao menos um número."),
  confirmarSenha: Yup.string()
    .required("Confirme a senha.")
    .oneOf([Yup.ref("senha")], "As senhas não coincidem."),
  aceite: Yup.boolean()
    .oneOf([true], "É preciso aceitar os termos para continuar.")
    .required(),
});
