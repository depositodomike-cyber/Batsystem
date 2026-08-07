import * as Yup from "yup";

/**
 * Tela 1 — criação de conta.
 *
 * Só nome, e-mail, senha e confirmação. NÃO existe campo de tipo de conta, de
 * plano, de documento ou de organização: a organização é a etapa seguinte.
 */
export interface CriarContaFormValues {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
}

export const criarContaSchema: Yup.ObjectSchema<CriarContaFormValues> =
  Yup.object().shape({
    nome: Yup.string().trim().required("Informe o seu nome."),
    email: Yup.string()
      .trim()
      .email("E-mail inválido.")
      .required("Informe o e-mail."),
    senha: Yup.string()
      .required("Crie uma senha.")
      .min(8, "Mínimo de 8 caracteres.")
      .matches(/[A-Za-z]/, "Inclua ao menos uma letra.")
      .matches(/[0-9]/, "Inclua ao menos um número."),
    confirmarSenha: Yup.string()
      .required("Confirme a senha.")
      .oneOf([Yup.ref("senha")], "As senhas não coincidem."),
  });
