import * as Yup from "yup";

import type { TipoUso } from "./tipoUso";

/**
 * Tela 2 — intenção de uso + campos condicionais.
 *
 * Em `personal`, o nome da organização é derivado do usuário no submit.
 * Em `organization`, nome é obrigatório e e-mails de convite são opcionais.
 */
export interface OrganizacaoFormValues {
  tipoUso: TipoUso;
  nomeOrganizacao: string;
  emails: string[];
}

export const organizacaoSchema: Yup.ObjectSchema<OrganizacaoFormValues> =
  Yup.object({
    tipoUso: Yup.mixed<TipoUso>()
      .oneOf(["personal", "organization"])
      .required("Escolha como pretende utilizar a plataforma."),
    nomeOrganizacao: Yup.string()
      .trim()
      .defined()
      .when("tipoUso", {
        is: "organization",
        then: (schema) =>
          schema.required("Informe o nome da organização."),
        otherwise: (schema) => schema.default(""),
      }),
    emails: Yup.array()
      .of(
        Yup.string()
          .trim()
          .email("E-mail inválido.")
          .required(),
      )
      .defined()
      .default([]),
  });
