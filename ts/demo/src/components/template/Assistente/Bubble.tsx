// Bolinha do assistente no canto inferior direito. Sempre disponível: um clique
// abre o painel (restaurando a conversa atual, se houver).
import { useTranslation } from "react-i18next";

import { useAssistente } from "@/app/contexts/assistente/context";
import { LogoMark } from "./LogoMark";

// ----------------------------------------------------------------------

export function Bubble() {
  const { t } = useTranslation();
  const { open, naoLido, status } = useAssistente();

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("chrome.assistantOpen")}
      aria-expanded={status === "open"}
      title={t("chrome.assistantOpen")}
      // Círculo de superfície (não gradiente): a marca tem cores próprias e
      // precisa de fundo neutro para ler bem nos dois temas.
      className="dark:bg-dark-700 dark:ring-dark-500 fixed right-5 bottom-5 z-[105] grid size-14 place-items-center rounded-full bg-white shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105"
    >
      <LogoMark className="size-8 shrink-0" />
      {naoLido && (
        <span className="dark:ring-dark-700 absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </button>
  );
}
