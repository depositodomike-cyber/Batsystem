/**
 * Intenção de uso + configuração da organização.
 *
 * Fluxo próprio (não é “etapa 2” da criação de conta). Usada no cadastro após
 * a confirmação de e-mail e também em `?novo=1` (menu de perfil).
 * Nos dois casos entra direto no produto com a organização recém-criada
 * já ativa — o menu de perfil troca de contexto, sem seletor intermediário.
 */

import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { useAuthContext } from "@/app/contexts/auth/context";
import { Button, InputErrorMsg } from "@/components/ui";
import { HOME_PATH } from "@/constants/app";
import { isOracleModuleVisible } from "@/configs/oracleModules";
import {
  descricaoModoLocal,
  garantirSessaoBackend,
} from "@/services/api/contaBackend";

import { MolduraAuth } from "../components/MolduraAuth";
import { OrganizationFields } from "../components/OrganizationFields";
import { TipoUsoSelector } from "../components/TipoUsoSelector";
import { usePrototipoContas, useUsuario } from "../model/context";
import {
  organizacaoSchema,
  type OrganizacaoFormValues,
} from "./organizacao.schema";

export default function ConfigurarOrganizacao() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const novaOrganizacao = searchParams.get("novo") === "1";
  // Oracle pessoal (módulo `organizations` oculto, configs/oracleModules.ts):
  // o uso é sempre pessoal e o seletor some. A criação interna segue igual —
  // a organização pessoal é o escopo técnico dos dados do dono.
  const comOrganizacoes = isOracleModuleVisible("organizations");
  const usuario = useUsuario();
  const { despachar } = usePrototipoContas();
  const { adoptSession } = useAuthContext();
  const [enviando, setEnviando] = useState(false);
  const [erroBackend, setErroBackend] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OrganizacaoFormValues>({
    resolver: yupResolver(organizacaoSchema),
    defaultValues: {
      tipoUso: comOrganizacoes && novaOrganizacao ? "organization" : "personal",
      nomeOrganizacao: "",
      emails: [],
    },
  });

  const tipoUso = useWatch({ control, name: "tipoUso" });

  if (!usuario) return <Navigate to="../criar-conta" replace />;
  // "Criar organização" (?novo=1) vinha do menu de perfil, oculto no Oracle.
  if (!comOrganizacoes && novaOrganizacao) {
    return <Navigate to={HOME_PATH} replace />;
  }

  const onSubmit = async (valores: OrganizacaoFormValues) => {
    setErroBackend(null);
    setEnviando(true);

    const pessoal = valores.tipoUso === "personal";
    const nome = pessoal
      ? usuario.nome.trim()
      : valores.nomeOrganizacao.trim();

    despachar({
      tipo: "organizacao/configurar",
      payload: {
        nome,
        pagador: {
          tipo: pessoal ? "pf" : "pj",
          documento: "",
          nomeLegal: nome,
        },
        emails: pessoal ? undefined : valores.emails,
      },
    });

    // Pelo perfil a conta já existe: não registrar de novo o mesmo e-mail.
    if (novaOrganizacao) {
      setEnviando(false);
      navigate(HOME_PATH);
      return;
    }

    const sessao = await garantirSessaoBackend({
      nome: usuario.nome,
      email: usuario.email,
      senha: usuario.senha,
      organizacaoNome: nome,
    });
    setEnviando(false);

    if (sessao.tipo === "conflito") {
      setErroBackend(sessao.mensagem);
      return;
    }

    if (sessao.tipo !== "ok") {
      setErroBackend(descricaoModoLocal(sessao.motivo));
      return;
    }

    adoptSession(sessao.authToken, sessao.user);
    navigate(HOME_PATH);
  };

  return (
    <MolduraAuth
      tituloPagina={
        !comOrganizacoes
          ? "Preparar o Oracle"
          : novaOrganizacao
            ? "Nova organização"
            : "Configurar organização"
      }
      kicker={
        !comOrganizacoes
          ? "Sua conta"
          : novaOrganizacao
            ? "Nova organização"
            : "Sua organização"
      }
      titulo={
        comOrganizacoes ? "Como você quer usar o Oracle?" : "Tudo pronto"
      }
      subtitulo={
        comOrganizacoes
          ? "Isso ajuda a personalizar sua experiência"
          : "Vamos preparar o seu espaço pessoal no Oracle."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        {comOrganizacoes && (
          <Controller
            name="tipoUso"
            control={control}
            render={({ field }) => (
              <TipoUsoSelector
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}
        {errors.tipoUso?.message && (
          <p className="mt-2 text-xs text-error dark:text-error-lighter">
            {errors.tipoUso.message}
          </p>
        )}

        {tipoUso === "organization" && (
          <div className="mt-5 space-y-4">
            <OrganizationFields
              registration={register("nomeOrganizacao")}
              error={errors?.nomeOrganizacao?.message}
            />
          </div>
        )}

        <div className="mt-2">
          <InputErrorMsg when={!!erroBackend}>{erroBackend}</InputErrorMsg>
        </div>

        <Button
          type="submit"
          className="mt-6 w-full"
          color="primary"
          disabled={enviando}
        >
          {enviando
            ? "Criando…"
            : tipoUso === "personal"
              ? "Continuar"
              : "Criar organização"}
        </Button>
      </form>
    </MolduraAuth>
  );
}
