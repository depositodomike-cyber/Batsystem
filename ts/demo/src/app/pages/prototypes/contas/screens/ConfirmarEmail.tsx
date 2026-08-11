/**
 * Confirmação de e-mail — estado visual simulado.
 *
 * Não envia e-mail nem valida token. Serve só para o percurso do protótipo:
 * após criar a conta, o usuário vê este aviso e, ao simular a confirmação,
 * segue para a criação da organização (fluxo separado).
 */

import { Link, Navigate, useNavigate } from "react-router";

import { Button } from "@/components/ui";
import { GHOST_ENTRY_PATH } from "@/constants/app";

import { MolduraAuth } from "../components/MolduraAuth";
import { useUsuario } from "../model/context";

export default function ConfirmarEmail() {
  const navigate = useNavigate();
  const usuario = useUsuario();

  if (!usuario) return <Navigate to="../criar-conta" replace />;

  return (
    <MolduraAuth
      tituloPagina="Confirme seu e-mail"
      titulo="Confirme seu e-mail"
      subtitulo="Verifique sua caixa de entrada para continuar"
      largura="max-w-[30rem]"
      depoisDoCard={
        <>
          <div className="mt-4 text-center text-xs-plus">
            <p className="line-clamp-1">
              <Link
                className="text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
                to={GHOST_ENTRY_PATH}
              >
                Entrar
              </Link>
            </p>
          </div>

          {/*
            Fora da tela de produto: bloco flutuante, com cara de toast, para
            deixar claro que o atalho existe só para navegar no protótipo.
          */}
          <div className="mt-10 flex justify-center">
            <div className="dark:border-dark-500 dark:bg-dark-800 w-full max-w-sm rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center shadow-lg dark:shadow-none">
              <p className="dark:text-dark-300 text-tiny text-gray-400">
                Apenas no protótipo — simula a confirmação do e-mail para seguir
                o fluxo de criação.
              </p>
              <Button
                type="button"
                variant="outlined"
                color="primary"
                className="mt-3 w-full"
                onClick={() => navigate("../organizacao")}
              >
                Já confirmei o e-mail
              </Button>
            </div>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <p className="dark:text-dark-200 text-sm text-gray-600">
          Se ainda não existir uma conta para{" "}
          <span className="dark:text-dark-50 font-medium text-gray-800">
            {usuario.email}
          </span>
          , enviamos um link para confirmar o endereço. Se já existir, avisamos
          por lá.
        </p>
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          Acesse o e-mail, confirme o endereço e, em seguida, continue o
          cadastro para criar sua organização.
        </p>
      </div>
    </MolduraAuth>
  );
}
