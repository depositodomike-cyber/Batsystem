// Aba Histórico do painel: conversas persistidas agrupadas por período. Clicar
// carrega a conversa dentro do próprio painel, sem sair da tela.
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { useAssistente } from "@/app/contexts/assistente/context";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { agruparPorPeriodo } from "@/app/pages/ceo/conversas-periodo";

// ----------------------------------------------------------------------

export function HistoricoTab() {
  const { t } = useTranslation();
  const { items } = useConversasContext();
  const { abrirConversa, conversaId, loading, expandido } = useAssistente();

  const grupos = agruparPorPeriodo(items);

  if (grupos.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="dark:text-dark-300 text-center text-xs text-gray-500">
          {t("chrome.assistantHistoryEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
      <div className={clsx(expandido && "mx-auto w-full max-w-3xl")}>
        {grupos.map((grupo) => (
          <div key={grupo.periodo} className="mb-3 last:mb-0">
            <p className="dark:text-dark-300 px-1 text-tiny font-medium tracking-wide text-gray-400 uppercase">
              {grupo.rotulo}
            </p>
            <div className="mt-1 flex flex-col gap-0.5">
              {grupo.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading}
                  onClick={() => void abrirConversa(item.id)}
                  className={clsx(
                    "w-full rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-50",
                    item.id === conversaId
                      ? "bg-primary-600/10 dark:bg-primary-400/10"
                      : "dark:hover:bg-dark-600/50 hover:bg-gray-100",
                  )}
                >
                  <p
                    className={clsx(
                      "truncate text-xs-plus font-medium",
                      item.id === conversaId
                        ? "text-primary-600 dark:text-primary-400"
                        : "dark:text-dark-100 text-gray-700",
                    )}
                  >
                    {item.title}
                  </p>
                  {item.preview && (
                    <p className="dark:text-dark-300 truncate text-tiny text-gray-400">
                      {item.preview}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
