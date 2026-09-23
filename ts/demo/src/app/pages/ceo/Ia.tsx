// Import Dependencies
import { Fragment, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { CriacoesLista } from "./CriacoesLista";
import { Button } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useIaModals } from "@/app/contexts/ia-modals/context";
import { IA_MODALS_BY_ID } from "@/app/contexts/ia-modals/registry";
import {
  AI_STUDIO_DISABLED,
  aiFunctionScreenPath,
  isAiStudioFunction,
  isAiStudioFunctionDisabled,
  isUploadFunction,
} from "./ia-functions";
import {
  isFeatureTemporarilyDisabled,
  isMemoryUploadFnTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

// O card da grade de funções saía daqui. A grade foi removida da Home (o
// collapse AI STUDIO do sidebar é o catálogo), e com ela o card que só ela
// usava. As FUNÇÕES continuam todas no produto: o sidebar as lança e o deep
// link `?fn=` segue funcionando — quem some é a segunda vitrine.

/**
 * Aviso de lançamento ("Em breve") bloqueando a tela do AI Studio. Ficou
 * desligado enquanto "Criar Dashboard" estava parcialmente liberado; com o
 * Studio inteiro desabilitado de novo, o aviso volta. A única saída do modal
 * leva ao Repositório (ver `grafoPath`).
 */
const AVISO_EM_BREVE_ATIVO = true;

/**
 * Aviso de lançamento: a grade desabilitada fica atrás, e a única saída é o
 * botão que leva ao Repositório (grafo ou lista, conforme `grafoPath`).
 * `onClose` é no-op de propósito — clique fora e Esc não fecham.
 */
function AiStudioComingSoonModal({
  open,
  grafoPath,
  destinoLista,
}: {
  open: boolean;
  grafoPath: string;
  /** Grafo desabilitado: a saída vai para a LISTA do Repositório. O texto
      acompanha, senão o botão promete um destino que não é o dele. */
  destinoLista: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        open={open}
        className="relative z-[80]"
        onClose={() => {
          /* modal bloqueante: só sai pelo botão do Grafo */
        }}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="dark:bg-dark-700 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <DialogTitle className="dark:text-dark-50 flex items-center gap-2.5 text-base font-semibold text-gray-800">
                <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-9 shrink-0 place-items-center rounded-lg">
                  <SparklesIcon className="size-5 stroke-[1.5]" />
                </span>
                {t("ai.comingSoonTitle")}
              </DialogTitle>
              <p className="dark:text-dark-300 mt-3 text-sm text-gray-500">
                {t(
                  destinoLista ? "ai.comingSoonBodyRepo" : "ai.comingSoonBody",
                )}
              </p>

              <div className="mt-6 flex justify-end">
                <Button color="primary" onClick={() => navigate(grafoPath)}>
                  {t(
                    destinoLista ? "ai.comingSoonCtaRepo" : "ai.comingSoonCta",
                  )}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------

export default function Ia() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const product = getCurrentProduct(pathname);
  const { open, states } = useIaModals();
  const grafoPath = isFeatureTemporarilyDisabled("memoryGraph")
    ? `/${product.code}/memoria-lista`
    : `/${product.code}/memoria-grafo`;

  const fnParam = searchParams.get("fn");
  useEffect(() => {
    if (!fnParam) return;
    const blocked =
      (isAiStudioFunction(fnParam) && isAiStudioFunctionDisabled(fnParam)) ||
      isMemoryUploadFnTemporarilyDisabled(fnParam);

    if (!blocked) {
      // Função que virou tela: o deep link antigo (`/ia?fn=apresentacao`) vira
      // uma navegação para ela. `replace` porque o histórico não deve guardar a
      // URL intermediária — e não há `setSearchParams` a fazer, já que saímos
      // desta rota.
      const tela = aiFunctionScreenPath(fnParam, product.code);
      if (tela) {
        navigate(tela, { replace: true });
        return;
      }
      // Deep links de upload abrem o modal único na aba correspondente.
      if (
        fnParam === "documento" ||
        fnParam === "audio" ||
        fnParam === "transcricao"
      ) {
        open("upload", { aba: fnParam });
      } else if (fnParam === "upload") {
        open("upload");
      } else if (IA_MODALS_BY_ID[fnParam]) {
        open(fnParam);
      }
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fn");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnParam]);

  // Os uploads do Repositório reaproveitam esta rota (`?fn=documento`), então o
  // aviso do AI Studio fica escondido enquanto houver janela de upload ativa.
  const avisoVisivel =
    AVISO_EM_BREVE_ATIVO &&
    AI_STUDIO_DISABLED &&
    !isUploadFunction(fnParam) &&
    Object.keys(states).length === 0;

  return (
    <Page title={`${t("ai.title")} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex items-center gap-3">
          <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-11 place-items-center rounded-xl">
            <SparklesIcon className="size-6 stroke-[1.5]" />
          </span>
          <div className="flex flex-col gap-0.5">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>{t("ai.help1")}</p>
                    <p>{t("ai.help2")}</p>
                  </>
                ),
              }}
            >
              {t("ai.title")}
            </PageTitle>
            <p className="dark:text-dark-300 text-sm text-gray-400">
              {t("ai.subtitle")}
            </p>
          </div>
        </div>

        {/* A grade de funções SAIU daqui: ela dizia "o que a IA pode criar?",
            que é exatamente o que o collapse AI STUDIO do sidebar já responde.
            Dois catálogos para a mesma pergunta, e nenhum lugar para a outra —
            "no que eu estou trabalhando?". A Home passou a responder essa. */}
        <section className="mt-6">
          <h3 className="dark:text-dark-200 text-tiny-plus mb-3 font-semibold tracking-wider text-gray-500 uppercase">
            {t("ai.recent")}
          </h3>
          <CriacoesLista produto={product.code} />
        </section>
      </div>

      <AiStudioComingSoonModal
        open={avisoVisivel}
        grafoPath={grafoPath}
        destinoLista={isFeatureTemporarilyDisabled("memoryGraph")}
      />
    </Page>
  );
}
