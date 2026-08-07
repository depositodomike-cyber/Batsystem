// Import Dependencies
import { Link, useNavigate } from "react-router";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import clsx from "clsx";

// Local Imports
import BecultureSignatureDark from "@/assets/branding/beculture-signature-dark.svg?react";
import { Button, Card, Checkbox, Input, InputErrorMsg } from "@/components/ui";
import { useAuthContext } from "@/app/contexts/auth/context";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";
import { usePrototipoContas } from "@/app/pages/prototypes/contas/model/context";
import { autenticar } from "@/app/pages/prototypes/contas/model/selectors";
import {
  descricaoModoLocal,
  garantirSessaoBackend,
} from "@/services/api/contaBackend";
import { HOME_PATH, SIGNUP_ENTRY_PATH } from "@/constants/app";
import { SPLASH_MIN_DURATION } from "@/components/template/SplashScreen";
import { AuthFormValues, schema } from "./schema";
import { Page } from "@/components/shared/Page";

// ----------------------------------------------------------------------

export default function SignIn() {
  const navigate = useNavigate();
  const { login, establishSession, adoptSession, errorMessage } =
    useAuthContext();
  const { estado, despachar } = usePrototipoContas();
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  /**
   * Contas do protótipo vêm primeiro. Quando batem, sincronizamos com o
   * backend (`/login` ou `/registrar`) para o JWT real liberar Regras e o
   * resto. Se a API estiver fora, caímos no token local.
   */
  const onSubmit = async (data: AuthFormValues) => {
    setErroLocal(null);

    const resultado = autenticar(estado, data.username, data.password);

    if (resultado.ok) {
      const { usuario } = resultado;
      despachar({ tipo: "sessao/login", payload: { email: usuario.email } });

      const org = estado.organizacoes.find((o) =>
        estado.membros.some(
          (m) => m.usuarioId === usuario.id && m.organizacaoId === o.id,
        ),
      );

      const sessao = await garantirSessaoBackend({
        nome: usuario.nome,
        email: usuario.email,
        senha: data.password,
        workspaceNome: org?.nome,
      });

      if (sessao.tipo === "conflito") {
        setErroLocal(sessao.mensagem);
        return;
      }

      flushSync(() => {
        if (sessao.tipo === "ok") {
          adoptSession(sessao.authToken, sessao.user);
        } else {
          establishSession({
            id: usuario.id,
            name: usuario.nome,
            email: usuario.email,
          });
        }
      });

      if (sessao.tipo === "local") {
        // O <Toaster/> só monta quando a splash sai de cena; avisar agora
        // perderia a mensagem.
        const motivo = sessao.motivo;
        window.setTimeout(() => {
          toast.message("Entrando em modo local", {
            description: descricaoModoLocal(motivo),
          });
        }, SPLASH_MIN_DURATION + 500);
      }

      navigate(HOME_PATH);
      return;
    }

    if (resultado.motivo === "senha") {
      setErroLocal("Senha incorreta.");
      return;
    }

    await login({
      username: data.username,
      password: data.password,
    });

    // Sem backend a API responde "Login failed", que não diz nada a quem
    // apenas errou o e-mail ou ainda não tem conta. O token é a única prova
    // confiável de sucesso aqui: o `isAuthenticated` do closure está velho.
    if (!window.localStorage.getItem("authToken")) {
      setErroLocal(
        'Nenhuma conta com este e-mail. Use "Criar conta" para começar.',
      );
    }
  };

  const erro = erroLocal ?? errorMessage;

  return (
    <Page title="Login">
      <main className="min-h-100vh grid w-full grow grid-cols-1 place-items-center">
        <div className="w-full max-w-[31rem] p-4 sm:px-5">
          <div className="text-center">
            <img
              src="/images/logos/beculture-login-logo.svg"
              alt="beculture"
              className="mx-auto h-12 w-auto dark:hidden"
            />
            <BecultureSignatureDark className="mx-auto hidden h-12 w-auto dark:block" />
            <div className="mt-4">
              <h2 className="text-2xl font-semibold text-gray-600 dark:text-dark-100">
                Bem-vindo de volta
              </h2>
              <p className="text-gray-400 dark:text-dark-300">
                Entre para continuar
              </p>
            </div>
          </div>
          <Card className="mt-5 rounded-lg p-5 lg:p-7">
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
              <div className="space-y-4">
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
                  {...register("username")}
                  error={errors?.username?.message}
                />
                <Input
                  label="Senha"
                  placeholder="Digite sua senha"
                  type="password"
                  prefix={
                    <LockClosedIcon
                      className="size-5 transition-colors duration-200"
                      strokeWidth="1"
                    />
                  }
                  {...register("password")}
                  error={errors?.password?.message}
                />
              </div>

              <div className="mt-2">
                <InputErrorMsg when={(erro && erro !== "") as boolean}>
                  {erro}
                </InputErrorMsg>
              </div>

              <div className="mt-4 flex items-center justify-between space-x-2">
                <Checkbox label="Lembrar de mim"/>
                <a
                  href="##"
                  className="text-xs text-gray-400 transition-colors hover:text-gray-800 focus:text-gray-800 dark:text-dark-300 dark:hover:text-dark-100 dark:focus:text-dark-100"
                >
                  Esqueceu a senha?
                </a>
              </div>

              <Button type="submit" className="mt-5 w-full" color="primary">
                Entrar
              </Button>
            </form>
            <div className="mt-4 text-center text-xs-plus">
              <p className="line-clamp-1">
                <span>Não tem conta?</span> <CriarContaLink />
              </p>
            </div>
          </Card>
          <div className="mt-8 flex justify-center text-xs text-gray-400 dark:text-dark-300">
            <a href="##">Política de Privacidade</a>
            <div className="mx-2.5 my-0.5 w-px bg-gray-200 dark:bg-dark-500"></div>
            <a href="##">Termos de Uso</a>
          </div>
        </div>
      </main>
    </Page>
  );
}

/* ---------------------------------------------------------------- */

/**
 * Link "Criar conta".
 *
 * Aponta para `SIGNUP_ENTRY_PATH` — hoje o protótipo do novo modelo de contas,
 * já que o funil legado (/cadastro) está oculto pelas flags `legacy*`. Se não
 * houver nenhum fluxo disponível (`SIGNUP_ENTRY_PATH === null` e flag ligada), o
 * link aparece opaco e sem clique, seguindo o padrão de
 * `temporarilyDisabledFeatures` — nunca como um link morto para uma rota
 * bloqueada.
 *
 * Nada foi removido: para voltar ao cadastro antigo, aponte SIGNUP_ENTRY_PATH
 * para "/cadastro" e zere a flag `legacySignup`.
 */
function CriarContaLink() {
  const legacyOculto = isFeatureTemporarilyDisabled("legacySignup");
  const destino = SIGNUP_ENTRY_PATH ?? (legacyOculto ? null : "/cadastro");

  if (!destino) {
    return (
      <span
        aria-disabled="true"
        title="Criar conta"
        className={clsx(
          "text-primary-600 dark:text-primary-400",
          DISABLED_MENU_CLASS,
        )}
      >
        Criar conta
      </span>
    );
  }

  return (
    <Link
      className="text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
      to={destino}
    >
      Criar conta
    </Link>
  );
}
