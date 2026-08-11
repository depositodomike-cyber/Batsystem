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
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { useAuthContext } from "@/app/contexts/auth/context";
import { Button, Input } from "@/components/ui";
import { GHOST_ENTRY_PATH } from "@/constants/app";

import { CampoSenha } from "../components/CampoSenha";
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
    formState: { errors },
  } = useForm<CriarContaFormValues>({
    resolver: yupResolver(criarContaSchema),
    defaultValues: { nome: "", email: "", senha: "", confirmarSenha: "" },
  });

  const onSubmit = (valores: CriarContaFormValues) => {
    if (usuarioPorEmail(estado, valores.email)) {
      setError("email", {
        type: "manual",
        message: "Já existe uma conta com este e-mail. Entre com ela.",
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
      subtitulo="Quatro campos. O resto vem depois."
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
          <CampoSenha
            label="Senha"
            placeholder="Mínimo de 8 caracteres"
            description="Ao menos uma letra e um número."
            registration={register("senha")}
            error={errors?.senha?.message}
          />
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
