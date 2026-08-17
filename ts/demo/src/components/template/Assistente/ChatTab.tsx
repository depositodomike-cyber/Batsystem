// Aba Chat do painel: estado vazio ou a lista de turnos da conversa atual.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { MarkdownView } from "@/app/pages/ceo/MarkdownView";
import { useAssistente } from "@/app/contexts/assistente/context";
import { Fontes } from "./Fontes";
import { LogoMark } from "./LogoMark";

// ----------------------------------------------------------------------

export function ChatTab() {
  const { t } = useTranslation();
  const { conversa, loading, expandido } = useAssistente();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Rola para o fim quando chega novo conteúdo. `expandido` entra nas deps
  // porque alternar o tamanho muda a altura do container.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [conversa, loading, expandido]);

  if (conversa.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <LogoMark className="size-12 shrink-0" />
        <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-800">
          {t("chrome.assistantEmptyTitle")}
        </p>
        <p className="dark:text-dark-300 mt-1 text-xs text-gray-500">
          {t("chrome.assistantEmptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={bodyRef}
      aria-live="polite"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
    >
      {/* Scroller full-bleed, conteúdo limitado: no modo ampliado a barra de
          rolagem continua na borda e as linhas não esticam. */}
      <div className={clsx(expandido && "mx-auto w-full max-w-3xl")}>
        {conversa.map((turno, i) => (
          <div
            key={i}
            className={clsx(
              i > 0 && "dark:border-dark-600 mt-4 border-t border-gray-100 pt-4",
            )}
          >
            {turno.pergunta && (
              <p className="text-primary-600 dark:text-primary-400 text-sm font-semibold">
                {turno.pergunta}
              </p>
            )}
            <div className="mt-1.5">
              {turno.pendente ? (
                <p className="dark:text-dark-300 flex items-center gap-2 text-sm text-gray-400">
                  <span className="border-primary-500 size-3 animate-spin rounded-full border-2 border-t-transparent" />
                  {t("chrome.assistantThinking")}
                </p>
              ) : (
                <MarkdownView>{turno.resposta}</MarkdownView>
              )}
            </div>
            {!turno.pendente && <Fontes fontes={turno.fontes} />}
          </div>
        ))}
      </div>
    </div>
  );
}
