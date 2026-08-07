/**
 * TELA 2 — Intenção de uso + configuração do espaço.
 *
 * Mesma rota de antes: a UI se adapta à escolha (pessoal vs empresa/equipe).
 * Pessoal cria organização automática com o nome do usuário (pagador pf).
 * Empresa pede nome + convites opcionais (pagador pj).
 */

import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import { useAuthContext } from "@/app/contexts/auth/context";
import { Button, InputErrorMsg } from "@/components/ui";
import {
  descricaoModoLocal,
  garantirSessaoBackend,
} from "@/services/api/contaBackend";

import { InviteMembersField } from "../components/InviteMembersField";
import { MolduraAuth } from "../components/MolduraAuth";
import { OrganizationFields } from "../components/OrganizationFields";
import { StepperConta } from "../components/StepperConta";
import { WorkspaceTypeSelector } from "../components/WorkspaceTypeSelector";
import { usePrototipoContas, useUsuario } from "../model/context";
import {
  organizacaoSchema,
  type OrganizacaoFormValues,
} from "./organizacao.schema";

export default function ConfigurarOrganizacao() {
  const navigate = useNavigate();
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
      workspaceType: "personal",
      nomeOrganizacao: "",
      emails: [],
    },
  });

  const workspaceType = useWatch({ control, name: "workspaceType" });
  const emails = useWatch({ control, name: "emails" }) ?? [];

  if (!usuario) return <Navigate to="../criar-conta" replace />;

  const onSubmit = async (valores: OrganizacaoFormValues) => {
    setErroBackend(null);
    setEnviando(true);

    const pessoal = valores.workspaceType === "personal";
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
      workspaceNome: nome,
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
      toast.message("Conta criada em modo local", {
        description: descricaoModoLocal(sessao.motivo),
      });
    }

    navigate("../repositorios");
  };

  return (
    <MolduraAuth
      tituloPagina="Configurar espaço"
      kicker="Etapa 2 · Seu espaço"
      titulo="Como você pretende utilizar a plataforma?"
      subtitulo="Escolha o tipo de uso. Campos extras só aparecem se forem necessários."
      antesDoCard={<StepperConta stepIndex={1} />}
    >
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <Controller
          name="workspaceType"
          control={control}
          render={({ field }) => (
            <WorkspaceTypeSelector
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.workspaceType?.message && (
          <p className="mt-2 text-xs text-error dark:text-error-lighter">
            {errors.workspaceType.message}
          </p>
        )}

        <div className="mt-5 space-y-4">
          {workspaceType === "personal" ? (
            <div className="dark:border-dark-600 dark:bg-dark-800 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="dark:text-dark-200 text-sm text-gray-600">
                Seu espaço será criado automaticamente utilizando seu nome.
              </p>
              <p className="dark:text-dark-100 mt-1.5 text-sm font-medium text-gray-800">
                {usuario.nome.trim()}
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

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
            : workspaceType === "personal"
              ? "Continuar"
              : "Criar organização"}
        </Button>
      </form>
    </MolduraAuth>
  );
}
