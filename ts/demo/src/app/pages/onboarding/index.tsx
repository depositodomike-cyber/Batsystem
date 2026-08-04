import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  EnvelopeIcon,
  PlusIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import BecultureSignature from "@/assets/branding/beculture-signature.svg?react";
import BecultureSignatureDark from "@/assets/branding/beculture-signature-dark.svg?react";
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { SplashScreen } from "@/components/template/SplashScreen";
import { Button, Card, Input } from "@/components/ui";
import { useAuthContext } from "@/app/contexts/auth/context";
import { useCompaniesContext } from "@/app/contexts/companies/context";
import { nomeModulo } from "@/app/data/modulos";
import { PLANOS } from "@/app/data/planos";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StepKey = "time" | "primeiros-passos";

const STEPS: { key: StepKey; titulo: string; Icon: typeof UsersIcon }[] = [
  { key: "time", titulo: "Seu time", Icon: UsersIcon },
  { key: "primeiros-passos", titulo: "Comece a usar", Icon: RocketLaunchIcon },
];

function diasRestantes(trialEndsAt: string): number {
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// Tempo mínimo que a animação de loading fica visível ao entrar no app, para a
// abertura da marca tocar por inteiro mesmo que o login resolva instantaneamente.
const ENTRADA_SPLASH_MS = 3500;

export default function Onboarding() {
  const navigate = useNavigate();
  const { refreshSession } = useAuthContext();
  const {
    usuarioAtual,
    empresaAtual,
    convidarUsuarios,
    convitesDaEmpresa,
    removerConvite,
    concluirOnboarding,
  } = useCompaniesContext();

  const [stepIndex, setStepIndex] = useState(0);
  const [entrando, setEntrando] = useState(false);

  // Etapa "time"
  const [emailInput, setEmailInput] = useState("");
  const [emailErro, setEmailErro] = useState<string | null>(null);

  // Sem sessão (acesso direto): volta ao cadastro.
  if (!usuarioAtual || !empresaAtual) {
    return <Navigate to="/cadastro" replace />;
  }

  // Ao finalizar, troca o wizard pela animação de loading da marca.
  if (entrando) {
    return <SplashScreen />;
  }

  const empresa = empresaAtual;
  const isPF = empresa.tipoPessoa === "pf";
  const convites = convitesDaEmpresa(empresa.id);
  const step = STEPS[stepIndex];

  const adicionarEmail = () => {
    const email = emailInput.trim();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setEmailErro("E-mail inválido.");
      return;
    }
    if (
      convites.some((c) => c.email.toLowerCase() === email.toLowerCase()) ||
      email.toLowerCase() === usuarioAtual.email.toLowerCase()
    ) {
      setEmailErro("Este e-mail já foi adicionado.");
      return;
    }
    const criados = convidarUsuarios(empresa.id, [email]);
    if (criados.length) {
      setEmailInput("");
      setEmailErro(null);
    }
  };

  const avancar = () =>
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));

  const voltar = () => setStepIndex((i) => Math.max(0, i - 1));

  const finalizar = async () => {
    setEntrando(true);
    concluirOnboarding(empresa.id);
    // Mostra a animação de loading enquanto autentica; garante um tempo mínimo
    // para a abertura da marca tocar antes de entrar no app.
    const animacao = new Promise((resolve) =>
      setTimeout(resolve, ENTRADA_SPLASH_MS),
    );
    // O cadastro já emitiu o JWT; aqui só reidratamos a sessão no AuthProvider.
    await Promise.all([refreshSession(), animacao]);
    navigate("/");
  };

  return (
    <Page title="Onboarding">
      <main className="min-h-100vh grid w-full grow grid-cols-1 place-items-center py-8">
        <div className="w-full max-w-[44rem] p-4 sm:px-5">
          <div className="text-center">
            <BecultureSignature className="mx-auto h-11 w-auto dark:hidden" />
            <BecultureSignatureDark className="mx-auto hidden h-11 w-auto dark:block" />
            <div className="mt-4">
              <PageTitle
                className="text-2xl font-semibold text-gray-600 dark:text-dark-100"
                wrapperClassName="justify-center"
                help={{
                  title: "Onboarding",
                  description: (
                    <>
                      <p>
                        Estes são os últimos passos antes de entrar no beculture:
                        convide o seu time (opcional) e confira o resumo da sua
                        conta e do teste grátis.
                      </p>
                      <p>
                        Você pode pular o convite e fazer isso depois, dentro do
                        painel. Ao concluir, o teste é ativado e você é levado
                        direto para a tela inicial do produto.
                      </p>
                    </>
                  ),
                }}
              >
                Vamos configurar sua conta
              </PageTitle>
              <p className="text-gray-400 dark:text-dark-300">
                Só mais dois passos para começar com o beculture.
              </p>
            </div>
          </div>

          <Stepper stepIndex={stepIndex} />

          <Card className="mt-5 rounded-lg p-5 lg:p-7">
            {step.key === "time" && (
              <EtapaTime
                isPF={isPF}
                emailInput={emailInput}
                emailErro={emailErro}
                convites={convites}
                onEmailChange={(v) => {
                  setEmailInput(v);
                  if (emailErro) setEmailErro(null);
                }}
                onAdicionar={adicionarEmail}
                onRemover={removerConvite}
              />
            )}

            {step.key === "primeiros-passos" && (
              <EtapaPrimeirosPassos
                empresa={empresa}
                nomeUsuario={usuarioAtual.nome}
                dias={diasRestantes(usuarioAtual.trialEndsAt)}
                convidados={convites.length}
              />
            )}

            {/* Navegação */}
            <div className="mt-7 flex items-center justify-between gap-3">
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="flat"
                  className="gap-2"
                  onClick={voltar}
                  disabled={entrando}
                >
                  <ArrowLeftIcon className="size-4" />
                  Voltar
                </Button>
              ) : (
                <span />
              )}

              {step.key !== "primeiros-passos" ? (
                <div className="flex items-center gap-3">
                  {step.key === "time" && (
                    <Button
                      type="button"
                      variant="flat"
                      onClick={avancar}
                      className="text-gray-500 dark:text-dark-300"
                    >
                      Pular
                    </Button>
                  )}
                  <Button
                    type="button"
                    color="primary"
                    className="gap-2"
                    onClick={avancar}
                  >
                    Continuar
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  color="primary"
                  className="gap-2"
                  onClick={finalizar}
                  disabled={entrando}
                >
                  {entrando ? "Entrando..." : "Entrar no beculture"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              )}
            </div>
          </Card>
        </div>
      </main>
    </Page>
  );
}

/* ---------------------------------------------------------------- */

function Stepper({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="mt-6 flex items-center justify-center">
      {STEPS.map((s, i) => {
        const concluido = i < stepIndex;
        const ativo = i === stepIndex;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={clsx(
                  "flex size-9 items-center justify-center rounded-full border-2 transition-colors",
                  concluido && "border-primary-500 bg-primary-500 text-white",
                  ativo &&
                    "border-primary-500 text-primary-600 dark:text-primary-400",
                  !concluido &&
                    !ativo &&
                    "border-gray-200 text-gray-300 dark:border-dark-500 dark:text-dark-400",
                )}
              >
                {concluido ? (
                  <CheckIcon className="size-4" strokeWidth="2.5" />
                ) : (
                  <s.Icon className="size-4.5" strokeWidth="1.8" />
                )}
              </span>
              <span
                className={clsx(
                  "hidden text-xs font-medium sm:block",
                  ativo || concluido
                    ? "text-gray-700 dark:text-dark-100"
                    : "text-gray-400 dark:text-dark-300",
                )}
              >
                {s.titulo}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={clsx(
                  "mx-2 h-0.5 w-10 rounded sm:w-16",
                  i < stepIndex
                    ? "bg-primary-500"
                    : "bg-gray-200 dark:bg-dark-500",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EtapaTime({
  isPF,
  emailInput,
  emailErro,
  convites,
  onEmailChange,
  onAdicionar,
  onRemover,
}: {
  isPF: boolean;
  emailInput: string;
  emailErro: string | null;
  convites: ReturnType<
    ReturnType<typeof useCompaniesContext>["convitesDaEmpresa"]
  >;
  onEmailChange: (v: string) => void;
  onAdicionar: () => void;
  onRemover: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 dark:text-dark-100">
        Convide seu time
      </h3>
      <p className="mt-1 text-sm text-gray-400 dark:text-dark-300">
        {isPF
          ? "Vai usar sozinho? Pode pular — dá para convidar gente depois."
          : "Adicione os e-mails de quem vai usar o beculture com você."}
      </p>

      <div className="mt-5 flex items-start gap-2">
        <Input
          placeholder="nome@empresa.com.br"
          type="email"
          classNames={{ root: "flex-1" }}
          prefix={<EnvelopeIcon className="size-5" strokeWidth="1" />}
          value={emailInput}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdicionar();
            }
          }}
          error={emailErro ?? undefined}
        />
        <Button
          type="button"
          color="primary"
          variant="outlined"
          className="mt-0 size-10 shrink-0 p-0"
          onClick={onAdicionar}
          aria-label="Adicionar convidado"
        >
          <PlusIcon className="size-5" />
        </Button>
      </div>

      {convites.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {convites.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-dark-500"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <UserIcon
                  className="size-4 shrink-0 text-gray-400 dark:text-dark-300"
                  strokeWidth="1.5"
                />
                <span className="truncate text-sm text-gray-700 dark:text-dark-100">
                  {c.email}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemover(c.id)}
                aria-label={`Remover ${c.email}`}
                className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-error dark:text-dark-300"
              >
                <XMarkIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center dark:border-dark-500">
          <UsersIcon
            className="mx-auto size-7 text-gray-300 dark:text-dark-400"
            strokeWidth="1.3"
          />
          <p className="mt-2 text-xs text-gray-400 dark:text-dark-300">
            Nenhum convite ainda. Você pode adicionar agora ou depois.
          </p>
        </div>
      )}
    </div>
  );
}

function EtapaPrimeirosPassos({
  empresa,
  nomeUsuario,
  dias,
  convidados,
}: {
  empresa: { plano: keyof typeof PLANOS; modulos: string[] };
  nomeUsuario: string;
  dias: number;
  convidados: number;
}) {
  const primeiroNome = nomeUsuario.trim().split(/\s+/)[0];
  const passos = useMemo(
    () => [
      {
        titulo: "Conta criada e teste ativado",
        descricao: `Seu teste grátis está rodando por mais ${dias} dia${
          dias === 1 ? "" : "s"
        }.`,
        feito: true,
      },
      {
        titulo:
          convidados > 0
            ? `${convidados} convite${convidados === 1 ? "" : "s"} pronto${
                convidados === 1 ? "" : "s"
              } para enviar`
            : "Convide seu time quando quiser",
        descricao:
          "Os convites são disparados assim que você entra no painel.",
        feito: convidados > 0,
      },
      {
        titulo: `Explore ${empresa.modulos.map(nomeModulo).join(", ")}`,
        descricao: "Comece pelo painel inicial e configure seu primeiro fluxo.",
        feito: false,
      },
    ],
    [dias, convidados, empresa.modulos],
  );

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <SparklesIcon className="size-6 text-primary-500" />
        <h3 className="text-base font-semibold text-gray-800 dark:text-dark-100">
          Tudo pronto, {primeiroNome}!
        </h3>
      </div>
      <p className="mt-1 text-sm text-gray-400 dark:text-dark-300">
        Plano <span className="font-medium">{PLANOS[empresa.plano].nome}</span>{" "}
        ativo. Veja seus próximos passos:
      </p>

      <ul className="mt-5 space-y-3">
        {passos.map((p, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={clsx(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                p.feito
                  ? "bg-primary-500 text-white"
                  : "border-2 border-gray-200 text-transparent dark:border-dark-500",
              )}
            >
              <CheckIcon className="size-3.5" strokeWidth="3" />
            </span>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-100">
                {p.titulo}
              </p>
              <p className="text-xs text-gray-400 dark:text-dark-300">
                {p.descricao}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-3 dark:bg-primary-500/10">
        <CheckCircleIcon className="size-5 shrink-0 text-primary-500" />
        <p className="text-xs text-primary-700 dark:text-primary-300">
          Sem cobranças durante o teste. Avisaremos antes de qualquer cobrança.
        </p>
      </div>
    </div>
  );
}
