// Aba Histórico do painel: conversas persistidas agrupadas por período. Clicar
// carrega a conversa dentro do próprio painel, sem sair da tela.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

import { useAssistente } from "@/app/contexts/assistente/context";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { agruparPorPeriodo } from "@/app/pages/ceo/conversas-periodo";

// ----------------------------------------------------------------------

export function HistoricoTab() {
  const { t } = useTranslation();
  const { items, remove } = useConversasContext();
  const { abrirConversa, conversaId, loading, expandido, novaConversa } =
    useAssistente();

  // Confirmação inline: o `ConfirmModal` compartilhado vive em `z-100` e o
  // painel em `z-[110]`, então um diálogo abriria ATRÁS desta janela.
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const excluir = async (id: string) => {
    setErro(null);
    setExcluindo(id);
    try {
      await remove(id);
      setConfirmando(null);
      // A conversa aberta acabou de sumir: volta o painel para uma nova.
      if (id === conversaId) novaConversa();
    } catch {
      setErro(id);
    } finally {
      setExcluindo(null);
    }
  };

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
    <div
      className={clsx(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        // Ampliado, as linhas ocupam a largura toda a 32px das bordas. O
        // `max-w-3xl` centralizado que havia aqui as deixava a ~116px num
        // modal de 1000px.
        expandido ? "p-8" : "px-3 py-3",
      )}
    >
      {grupos.map((grupo) => (
        <div key={grupo.periodo} className="mb-3 last:mb-0">
          <p className="dark:text-dark-300 px-1 text-tiny font-medium tracking-wide text-gray-400 uppercase">
            {grupo.rotulo}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {grupo.items.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  "group flex items-center rounded-lg transition-colors",
                  item.id === conversaId
                    ? "bg-primary-600/10 dark:bg-primary-400/10"
                    : "dark:hover:bg-dark-600/50 hover:bg-gray-100",
                )}
              >
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void abrirConversa(item.id)}
                  className="min-w-0 flex-1 px-2 py-1.5 text-left disabled:opacity-50"
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
                  {erro === item.id ? (
                    <p className="text-error dark:text-error-light truncate text-tiny">
                      {t("chrome.assistantHistoryDeleteError")}
                    </p>
                  ) : (
                    item.preview && (
                      <p className="dark:text-dark-300 truncate text-tiny text-gray-400">
                        {item.preview}
                      </p>
                    )
                  )}
                </button>

                {confirmando === item.id ? (
                  <span className="flex shrink-0 items-center gap-0.5 pr-1">
                    <AcaoLinha
                      icon={CheckIcon}
                      label={t("chrome.assistantHistoryDeleteConfirm")}
                      disabled={excluindo === item.id}
                      onClick={() => void excluir(item.id)}
                      className="text-error hover:bg-error/10 dark:text-error-light"
                    />
                    <AcaoLinha
                      icon={XMarkIcon}
                      label={t("chrome.assistantHistoryDeleteCancel")}
                      disabled={excluindo === item.id}
                      onClick={() => {
                        setConfirmando(null);
                        setErro(null);
                      }}
                    />
                  </span>
                ) : (
                  <span className="shrink-0 pr-1">
                    <AcaoLinha
                      icon={TrashIcon}
                      label={t("chrome.assistantHistoryDelete")}
                      onClick={() => {
                        setErro(null);
                        setConfirmando(item.id);
                      }}
                      // Só some onde existe hover para revelá-lo de volta: o
                      // `group-hover` do Tailwind já nasce dentro de
                      // `@media (hover:hover)`, então esconder no toque
                      // (celular ou tablet) deixaria o ícone inalcançável.
                      className="[@media(hover:hover)]:sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------

/** Botão de ícone das ações da linha (excluir, confirmar, cancelar). */
function AcaoLinha({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={clsx(
        "dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 grid size-7 place-items-center rounded-md text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 disabled:opacity-40",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
