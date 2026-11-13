// Etapas de um turno resolvido pelo orquestrador. Enquanto a resposta não
// chega, a lista aparece aberta e atualiza ao vivo; depois recolhe num resumo
// ("Resolvido em 4 etapas") que abre sob demanda. Numa conversa reaberta o
// turno só tem o id da execução, e as etapas são buscadas no primeiro clique.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  NoSymbolIcon,
  StopCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

import type { ExecucaoDoTurno } from "@/app/contexts/assistente/context";
import {
  etapasParaTela,
  fetchExecucaoApi,
  type EtapaOrquestrador,
  type StatusEtapa,
} from "@/services/api/orquestrador";
import { desfazerComandoApi, pararDesktopApi } from "@/services/api/desktop";

/**
 * "Desfazer": fecha o app que um comando direto acabou de abrir (até 2 min;
 * o servidor confere). Contrapeso de abrir apps por voz sem confirmação.
 */
function DesfazerAbertura({ execucaoId }: { execucaoId: string }) {
  const [estado, setEstado] = useState<"pronto" | "desfazendo" | "feito">("pronto");
  if (estado === "feito") return null;
  return (
    <button
      type="button"
      disabled={estado === "desfazendo"}
      onClick={() => {
        setEstado("desfazendo");
        void desfazerComandoApi(execucaoId)
          .then((r) => {
            toast.success(r.mensagem || "Desfeito.");
            setEstado("feito");
          })
          .catch((e: { response?: { data?: { message?: string } } }) => {
            toast.error(e?.response?.data?.message ?? "Não foi possível desfazer.");
            setEstado("pronto");
          });
      }}
      className="dark:text-dark-300 ml-3 text-xs text-gray-500 underline-offset-2 hover:underline"
    >
      {estado === "desfazendo" ? "Desfazendo…" : "Desfazer"}
    </button>
  );
}

/** Botão "Parar" enquanto houver ação no computador em curso (SR-31). */
function PararComputador() {
  const [parando, setParando] = useState(false);
  return (
    <button
      type="button"
      disabled={parando}
      onClick={() => {
        setParando(true);
        void pararDesktopApi()
          .then(() => toast.success("Tudo parado no computador. Retome em Configurações > Ambiente local."))
          .catch(() => toast.error("Não consegui parar pelo servidor. Use \"Parar tudo\" no ícone do Oracle na bandeja."))
          .finally(() => setParando(false));
      }}
      className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      <StopCircleIcon className="size-3.5" /> {parando ? "Parando…" : "Parar ações no computador"}
    </button>
  );
}

// ----------------------------------------------------------------------

function IconeStatus({ status }: { status: StatusEtapa }) {
  if (status === "executando") {
    return (
      <span className="border-primary-500 mt-0.5 size-3 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
    );
  }
  if (status === "falhou") {
    return <XCircleIcon className="mt-px size-3.5 shrink-0 text-red-500" />;
  }
  if (status === "aguardando_aprovacao") {
    return <ClockIcon className="text-warning mt-px size-3.5 shrink-0" />;
  }
  if (status === "negada") {
    return <NoSymbolIcon className="dark:text-dark-300 mt-px size-3.5 shrink-0 text-gray-400" />;
  }
  return <CheckCircleIcon className="text-primary-500 mt-px size-3.5 shrink-0" />;
}

function ListaEtapas({ etapas }: { etapas: EtapaOrquestrador[] }) {
  return (
    <ul className="space-y-1">
      {etapas.map((e) => (
        <li
          key={e.chave}
          className="dark:text-dark-200 flex items-start gap-1.5 text-xs text-gray-600"
          title={e.erro ?? undefined}
        >
          <IconeStatus status={e.status} />
          <span className={clsx("min-w-0 break-words", e.status === "falhou" && "line-through opacity-70")}>
            {e.descricao}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EtapasExecucao({
  execucao,
  pendente,
}: {
  execucao: ExecucaoDoTurno;
  pendente?: boolean;
}) {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);
  const [carregadas, setCarregadas] = useState<EtapaOrquestrador[] | null>(null);
  const [erro, setErro] = useState(false);

  // Durante a execução — ou parada esperando aprovação: visível, ao vivo.
  if (pendente || execucao.aprovacoes?.length) {
    return (
      <div className="dark:border-dark-500 mt-1.5 mb-2 border-l-2 border-gray-200 pl-2.5">
        {execucao.etapas.length === 0 ? (
          <p className="dark:text-dark-300 text-xs text-gray-400">
            {t("chrome.assistantPlanning")}
          </p>
        ) : (
          <ListaEtapas etapas={execucao.etapas} />
        )}
        {execucao.etapas.some(
          (e) => e.ferramenta?.startsWith("desktop_") && (e.status === "executando" || e.status === "aguardando_aprovacao"),
        ) && <PararComputador />}
      </div>
    );
  }

  const etapas = execucao.etapas.length ? execucao.etapas : (carregadas ?? []);
  const total = execucao.etapas.length || carregadas?.length || 0;

  const alternar = async () => {
    const abrir = !aberto;
    setAberto(abrir);
    if (!abrir || execucao.etapas.length || carregadas || !execucao.id) return;
    try {
      const ex = await fetchExecucaoApi(execucao.id);
      setCarregadas(etapasParaTela(ex.etapas));
      setErro(false);
    } catch {
      setErro(true);
    }
  };

  return (
    <div className="mt-1.5 mb-1">
      <button
        type="button"
        onClick={() => void alternar()}
        aria-expanded={aberto}
        className="dark:text-dark-300 dark:hover:text-dark-100 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <ChevronDownIcon className={clsx("size-3 transition-transform", aberto && "rotate-180")} />
        {total
          ? t("chrome.assistantStepsDone", { count: total })
          : t("chrome.assistantStepsShow")}
      </button>
      {execucao.id &&
        execucao.etapas.some((e) => e.ferramenta === "desktop_abrir_aplicativo" && e.status === "concluida") && (
          <DesfazerAbertura execucaoId={execucao.id} />
        )}
      {aberto && (
        <div className="dark:border-dark-500 mt-1.5 border-l-2 border-gray-200 pl-2.5">
          {erro ? (
            <p className="text-xs text-red-500">{t("chrome.assistantStepsError")}</p>
          ) : etapas.length ? (
            <ListaEtapas etapas={etapas} />
          ) : (
            <p className="dark:text-dark-300 text-xs text-gray-400">{t("chrome.assistantThinking")}</p>
          )}
        </div>
      )}
    </div>
  );
}
