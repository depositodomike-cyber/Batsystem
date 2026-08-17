/**
 * Criação de conta.
 *
 * Formulário deliberadamente mínimo: nome, e-mail, senha e confirmação.
 * Após o submit, o fluxo vai para a confirmação de e-mail simulada — a
 * organização é um fluxo separado, não uma “próxima etapa” deste formulário.
 */

import { yupResolver } from "@hookform/resolvers/yup";
import { EnvelopeIcon, UserIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { useAuthContext } from "@/app/contexts/auth/context";
import { Button, Input } from "@/components/ui";
import { GHOST_ENTRY_PATH } from "@/constants/app";

import { CampoSenha } from "../components/CampoSenha";
import { ChecklistSenha } from "../components/ChecklistSenha";
import { MolduraAuth } from "../components/MolduraAuth";
import { usePrototipoContas } from "../model/context";
import { usuarioPorEmail } from "../model/selectors";
import {
  criarContaSchema,
  type CriarContaFormValues,
} from "./criarConta.schema";

export default function CriarConta() {
  const navigate = useNavigate();
  const { estado, despachar } = usePrototipoContas();
  const { logout } = useAuthContext();

  // Encerra a conta anterior nos DOIS lados (protótipo e sessão autenticada).
  // Sem o logout da auth, o token da conta anterior sobrevivia ao cadastro e a
  // app voltava a exibir aquela conta.
  useEffect(() => {
    despachar({ tipo: "sessao/logout" });
    logout();
  }, [despachar, logout]);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitted },
  } = useForm<CriarContaFormValues>({
    resolver: yupResolver(criarContaSchema),
    defaultValues: { nome: "", email: "", senha: "", confirmarSenha: "" },
  });

  const senha = useWatch({ control, name: "senha", defaultValue: "" });
  const mostrarErrosSenha = isSubmitted || !!errors.senha;

  const onSubmit = (valores: CriarContaFormValues) => {
    if (usuarioPorEmail(estado, valores.email)) {
      setError("email", {
        type: "manual",
        message:
          "Não foi possível criar a conta com este e-mail. Tente entrar ou use outro e-mail.",
      });
      return;
    }

    despachar({
      tipo: "conta/criar",
      payload: {
        nome: valores.nome,
        email: valores.email,
        senha: valores.senha,
      },
    });
    navigate("../confirmar-email");
  };

  return (
    <MolduraAuth
      tituloPagina="Criar conta"
      titulo="Crie a sua conta"
      subtitulo="Preencha suas informações pessoais para continuar."
      largura="max-w-[30rem]"
      depoisDoCard={
        <div className="mt-4 text-center text-xs-plus">
          <p className="line-clamp-1">
            <span>Já tem conta?</span>{" "}
            <Link
              className="text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
              to={GHOST_ENTRY_PATH}
            >
              Entrar
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <div className="space-y-4">
          <Input
            label="Nome"
            placeholder="Como você se chama"
            autoComplete="name"
            prefix={
              <UserIcon
                className="size-5 transition-colors duration-200"
                strokeWidth="1"
              />
            }
            {...register("nome")}
            error={errors?.nome?.message}
          />
          <Input
            label="E-mail"
            placeholder="voce@empresa.com"
            autoComplete="email"
            prefix={
              <EnvelopeIcon
                className="size-5 transition-colors duration-200"
                strokeWidth="1"
              />
            }
            {...register("email")}
            error={errors?.email?.message}
          />
          <div>
            <CampoSenha
              label="Senha"
              placeholder="Crie uma senha"
              registration={register("senha")}
              error={errors?.senha?.message}
            />
            <ChecklistSenha senha={senha} mostrarErros={mostrarErrosSenha} />
          </div>
          <CampoSenha
            label="Confirmar senha"
            placeholder="Repita a senha"
            registration={register("confirmarSenha")}
            error={errors?.confirmarSenha?.message}
          />
        </div>

        <Button type="submit" className="mt-5 w-full" color="primary">
          Criar conta
        </Button>
      </form>
    </MolduraAuth>
  );
}
