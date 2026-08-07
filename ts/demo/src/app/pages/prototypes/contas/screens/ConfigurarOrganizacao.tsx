/**
 * TELA 2 — Intenção de uso + configuração da organização.
 *
 * Usada no cadastro e também em `?novo=1` (criar organização pelo menu de perfil).
 * Cadastro: pessoal → produto; corporativo → seletor.
 * Perfil (`novo=1`): sempre → seletor com as organizações existentes.
 */

import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { useAuthContext } from "@/app/contexts/auth/context";
import { Button, InputErrorMsg } from "@/components/ui";
import { HOME_PATH } from "@/constants/app";
import {
  descricaoModoLocal,
  garantirSessaoBackend,
} from "@/services/api/contaBackend";

import { InviteMembersField } from "../components/InviteMembersField";
import { MolduraAuth } from "../components/MolduraAuth";
import { OrganizationFields } from "../components/OrganizationFields";
import { StepperConta } from "../components/StepperConta";
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
  const usuario = useUsuario();
  const { despachar } = usePrototipoContas();
  const { adoptSession, establishSession } = useAuthContext();
  const [enviando, setEnviando] = useState(false);
  const [erroBackend, setErroBackend] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<OrganizacaoFormValues>({
    resolver: yupResolver(organizacaoSchema),
    defaultValues: {
      tipoUso: "personal",
      nomeOrganizacao: "",
      emails: [],
    },
  });

  const tipoUso = useWatch({ control, name: "tipoUso" });
  const emails = useWatch({ control, name: "emails" }) ?? [];

  if (!usuario) return <Navigate to="../criar-conta" replace />;

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

    if (sessao.tipo === "ok") {
      adoptSession(sessao.authToken, sessao.user);
    } else {
      establishSession({
        id: usuario.id,
        name: usuario.nome,
        email: usuario.email,
      });
      toast.message(
        novaOrganizacao
          ? "Organização criada em modo local"
          : "Conta criada em modo local",
        {
          description: descricaoModoLocal(sessao.motivo),
        },
      );
    }

    // Pelo perfil sempre vai ao seletor; no cadastro, pessoal entra direto.
    if (novaOrganizacao || !pessoal) {
      navigate("../repositorios");
    } else {
      navigate(HOME_PATH);
    }
  };

  return (
    <MolduraAuth
      tituloPagina={
        novaOrganizacao ? "Nova organização" : "Configurar organização"
      }
      kicker={
        novaOrganizacao ? "Nova organização" : "Etapa 2 · Sua organização"
      }
      titulo="Como você quer usar a beculture?"
      subtitulo="Isso ajuda a personalizar sua experiência"
      antesDoCard={
        novaOrganizacao ? undefined : <StepperConta stepIndex={1} />
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
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
            <InviteMembersField
              emails={emails}
              emailDoUsuario={usuario.email}
              onChange={(proximos) =>
                setValue("emails", proximos, { shouldValidate: true })
              }
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
