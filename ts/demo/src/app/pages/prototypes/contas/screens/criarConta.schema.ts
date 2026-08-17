import * as Yup from "yup";

import { requisitosSenhaAtendidos } from "../components/passwordRequirements";

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
      .test(
        "requisitos",
        "A senha não atende a todos os requisitos.",
        (valor) => requisitosSenhaAtendidos(valor ?? ""),
      ),
    confirmarSenha: Yup.string()
      .required("Confirme a senha.")
      .oneOf([Yup.ref("senha")], "As senhas não coincidem."),
  });
