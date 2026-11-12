// Tarefas do orquestrador que ainda pedem algo do usuário: esperando
// aprovação, interrompidas por uma queda da API (retomáveis) ou ainda rodando.
// Fica no topo do Chat e some quando não há nada — ou quando a tarefa já está
// sendo mostrada na própria conversa.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronDownIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";

import { useAssistente } from "@/app/contexts/assistente/context";
import type { ExecucaoAberta } from "@/services/api/orquestrador";

// ----------------------------------------------------------------------

function Item({ e }: { e: ExecucaoAberta }) {
  const { t } = useTranslation();
  const { abrirExecucao, descartarExecucao, loading } = useAssistente();
  const parada = e.status === "aguardando_aprovacao" || e.status === "interrompida";

  const situacao =
    e.status === "aguardando_aprovacao"
      ? t("chrome.assistantTaskWaiting", { count: e.aprovacoes.length })
      : e.status === "interrompida"
        ? e.retomavel
          ? t("chrome.assistantTaskInterrupted")
          : t("chrome.assistantTaskInterruptedNoResume")
        : t("chrome.assistantTaskRunning");

  const acao =
    e.status === "aguardando_aprovacao"
      ? t("chrome.assistantTaskReview")
      : e.status === "interrompida" && e.retomavel
        ? t("chrome.assistantTaskResume")
        : t("chrome.assistantTaskOpen");

  return (
    <li className="dark:border-dark-600 border-t border-gray-100 py-2 first:border-t-0">
      <p className="dark:text-dark-100 line-clamp-2 text-xs font-medium break-words text-gray-800">{e.pedido}</p>
      <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-500">{situacao}</p>
      <div className="mt-1.5 flex gap-3 text-xs">
        <button
          type="button"
          disabled={loading}
          onClick={() => void abrirExecucao(e)}
          className="text-primary-600 dark:text-primary-400 font-semibold hover:underline disabled:opacity-50"
        >
          {acao}
        </button>
        {parada && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void descartarExecucao(e.id)}
            className="dark:text-dark-300 text-gray-500 hover:underline disabled:opacity-50"
          >
            {t("chrome.assistantTaskDiscard")}
          </button>
        )}
      </div>
    </li>
  );
}

export function TarefasAbertas() {
  const { t } = useTranslation();
  const { abertas, conversa } = useAssistente();
  const [aberto, setAberto] = useState(true);

  // A que já está na conversa aberta é tratada lá mesmo (cartão de aprovação).
  const naTela = new Set(conversa.map((turno) => turno.execucao?.id).filter(Boolean));
  const lista = abertas.filter((e) => !naTela.has(e.id));
  if (lista.length === 0) return null;

  return (
    <div className="dark:border-dark-500 dark:bg-dark-700/40 mx-4 mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="dark:text-dark-100 flex w-full items-center gap-1.5 text-xs font-semibold text-gray-700"
      >
        <ClipboardDocumentListIcon className="size-4 shrink-0" />
        <span className="flex-1 text-start">{t("chrome.assistantTasksTitle", { count: lista.length })}</span>
        <ChevronDownIcon className={clsx("size-3.5 transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <ul className="mt-1">
          {lista.map((e) => (
            <Item key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}
