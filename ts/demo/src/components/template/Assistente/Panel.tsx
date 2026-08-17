// Painel do assistente, em dois tamanhos: ancorado no canto inferior direito ou
// ampliado como janela central com backdrop. Header com identidade do
// assistente, abas Chat/Histórico, corpo e campo de envio nos dois modos.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHotkeys } from "react-hotkeys-hook";
import {
  ArrowUpIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { useAssistente } from "@/app/contexts/assistente/context";
import type { AssistenteTab } from "@/app/contexts/assistente/context";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { ChatTab } from "./ChatTab";
import { HistoricoTab } from "./HistoricoTab";
import { LogoMark } from "./LogoMark";

// ----------------------------------------------------------------------

export function Panel() {
  const { t } = useTranslation();
  const { items } = useConversasContext();
  const {
    status,
    tab,
    setTab,
    conversa,
    modoConversa,
    loading,
    expandido,
    setExpandido,
    close,
    minimize,
    novaConversa,
    perguntar,
    continuar,
  } = useAssistente();

  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visivel = status === "open";
  const amplo = expandido && visivel;

  // ESC em dois níveis: ampliado recolhe para o canto, ancorado fecha.
  useHotkeys("esc", () => (expandido ? setExpandido(false) : close()), {
    enableOnFormTags: true,
    enabled: visivel,
  });

  // Foca o campo ao abrir o painel na aba Chat. Minimizar não desmonta o painel,
  // então o rascunho do campo sobrevive.
  useEffect(() => {
    if (visivel && tab === "chat") inputRef.current?.focus();
  }, [visivel, tab, expandido]);

  const enviar = () => {
    const valor = texto.trim();
    if (!valor || loading) return;
    setTexto("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    // Sem conversa aberta, o campo do painel inicia uma; com conversa, continua.
    if (conversa.length === 0) {
      void perguntar({ texto: valor, modo: modoConversa });
    } else {
      void continuar(valor);
    }
  };

  return (
    <>
      {/* Backdrop do modo ampliado. Clicar RECOLHE — fechar descartaria a
          conversa. O gate inclui `visivel`: minimizar estando ampliado não pode
          deixar um véu invisível bloqueando cliques no app. */}
      <div
        aria-hidden="true"
        onClick={() => setExpandido(false)}
        className={clsx(
          "dark:bg-black/40 fixed inset-0 z-[109] bg-gray-900/50 backdrop-blur-sm transition-opacity duration-200",
          amplo ? "opacity-100" : "pointer-events-none invisible opacity-0",
        )}
      />

      <div
        role="dialog"
        aria-label={t("chrome.assistantName")}
        aria-hidden={!visivel}
        aria-modal={amplo}
        tabIndex={-1}
        className={clsx(
          // Base sem geometria: cada variante carrega a sua por inteiro, para
          // que uma medida de um modo nunca limite a do outro.
          "dark:border-dark-500 dark:bg-dark-700 fixed z-[110] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 transition-[opacity,transform] duration-200",
          expandido
            ? // `inset-0 m-auto` centraliza: com insets 0 e tamanho definido, a
              // sobra é dividida entre as margens `auto`, em pixel inteiro.
              "inset-0 m-auto h-[min(860px,calc(100dvh-4rem))] w-[min(1000px,calc(100vw-4rem))] max-sm:inset-2 max-sm:h-auto max-sm:w-auto"
            : "right-5 bottom-5 h-[min(680px,calc(100dvh-7rem))] w-[400px] max-w-[calc(100vw-2.5rem)] max-sm:inset-x-2 max-sm:top-16 max-sm:bottom-2 max-sm:h-auto max-sm:w-auto max-sm:max-w-none",
          visivel
            ? "translate-y-0 opacity-100"
            : "pointer-events-none invisible translate-y-2 opacity-0",
        )}
      >
        {/* Cabeçalho */}
        <div className="from-primary-600 to-primary-500 flex shrink-0 items-center gap-2.5 bg-gradient-to-r px-4 py-3 text-white">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
            <LogoMark className="size-6" onLight />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {t("chrome.assistantName")}
            </p>
            <p className="flex items-center gap-1.5 text-tiny text-white/80">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {t("chrome.assistantOnline")}
            </p>
          </div>
          <HeaderBtn
            icon={PlusIcon}
            label={t("chrome.assistantNew")}
            onClick={novaConversa}
          />
          <HeaderBtn
            icon={expandido ? ArrowsPointingInIcon : ArrowsPointingOutIcon}
            label={
              expandido
                ? t("chrome.assistantCollapse")
                : t("chrome.assistantExpand")
            }
            onClick={() => setExpandido(!expandido)}
          />
          <HeaderBtn
            icon={MinusIcon}
            label={t("chrome.assistantMinimize")}
            onClick={minimize}
          />
          <HeaderBtn
            icon={XMarkIcon}
            label={t("chrome.assistantClose")}
            onClick={close}
          />
        </div>

        {/* Abas */}
        <div className="dark:border-dark-600 flex shrink-0 border-b border-gray-100">
          <TabButton
            id="chat"
            active={tab === "chat"}
            icon={ChatBubbleLeftRightIcon}
            label={t("chrome.assistantTabChat")}
            onClick={setTab}
          />
          <TabButton
            id="historico"
            active={tab === "historico"}
            icon={ClockIcon}
            label={t("chrome.assistantTabHistory")}
            count={items.length}
            onClick={setTab}
          />
        </div>

        {tab === "chat" ? <ChatTab /> : <HistoricoTab />}

        {/* Campo de envio */}
        {tab === "chat" && (
          <div className="dark:border-dark-600 dark:bg-dark-800/40 shrink-0 border-t border-gray-100 bg-gray-50/60 p-2.5">
            <div
              className={clsx(
                "dark:border-dark-500 dark:bg-dark-700 focus-within:border-primary-500/60 flex items-end gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5",
                // Ampliado: acompanha a largura do corpo em vez de esticar.
                expandido && "mx-auto w-full max-w-3xl",
              )}
            >
              <MemoriaTextarea
                ref={inputRef}
                rows={1}
                value={texto}
                disabled={loading}
                placeholder={
                  conversa.length === 0
                    ? t("chrome.assistantPlaceholder")
                    : modoConversa === "web"
                      ? t("chrome.assistantContinueWeb")
                      : t("chrome.assistantContinue")
                }
                onChange={(e) => {
                  setTexto(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                className="dark:text-dark-100 max-h-[120px] flex-1 resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={loading || !texto.trim()}
                title={t("chrome.assistantSend")}
                className="from-primary-600 to-primary-400 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white transition-opacity disabled:opacity-40"
              >
                <ArrowUpIcon className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ----------------------------------------------------------------------

function HeaderBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-7 shrink-0 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
    >
      <Icon className="size-4" />
    </button>
  );
}

function TabButton({
  id,
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  id: AssistenteTab;
  active: boolean;
  icon: React.ElementType;
  label: string;
  count?: number;
  onClick: (id: AssistenteTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      aria-selected={active}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-xs-plus font-medium transition-colors",
        active
          ? "border-primary-500 text-primary-600 dark:text-primary-400"
          : "dark:text-dark-300 dark:hover:text-dark-100 border-transparent text-gray-400 hover:text-gray-600",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className="dark:bg-dark-500 dark:text-dark-200 rounded-full bg-gray-100 px-1.5 text-tiny text-gray-500">
          {count}
        </span>
      )}
    </button>
  );
}
