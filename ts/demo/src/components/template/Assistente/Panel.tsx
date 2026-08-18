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
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button } from "@/components/ui";
import { Tooltip } from "@/components/shared/Tooltip";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { useAssistente } from "@/app/contexts/assistente/context";
import type { AssistenteTab } from "@/app/contexts/assistente/context";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { ChatTab } from "./ChatTab";
import { HistoricoTab } from "./HistoricoTab";

// ----------------------------------------------------------------------

/** Ancora os tooltips dos botões do cabeçalho (ver <Tooltip/> no JSX). */
const TOOLTIP_ID = "assistente-header-tooltip";

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
  const encaixado = visivel && !expandido;

  // ESC em dois níveis: tela cheia volta ao encaixe, encaixado fecha.
  useHotkeys("esc", () => (expandido ? setExpandido(false) : close()), {
    enableOnFormTags: true,
    enabled: visivel,
  });

  // Encaixado, o painel divide a tela com o app: a classe no `body` é o que
  // empurra o header e o main (regra em styles/layouts.css). Sai junto com o
  // painel — minimizar, fechar ou ir para tela cheia devolve a largura.
  useEffect(() => {
    if (!encaixado) return;
    document.body.classList.add("is-assistant-docked");
    return () => document.body.classList.remove("is-assistant-docked");
  }, [encaixado]);

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
      {/* Sem backdrop: encaixado, o conteúdo ao lado tem de seguir clicável;
          em tela cheia, um véu cobriria o sidebar, que deve continuar
          acessível. Saídas: ESC, Recolher, Minimizar e Fechar. */}
      <div
        role="dialog"
        aria-label={t("chrome.assistantName")}
        aria-hidden={!visivel}
        tabIndex={-1}
        className={clsx(
          // Sem sombra nem anel: a separação do conteúdo é feita por borda.
          // Mobile-first: no celular os dois modos são a MESMA folha de tela
          // cheia, sem margem nem canto arredondado. O `sm:` reintroduz o
          // desktop — mesmo idioma do RightSidebar.
          "dark:border-dark-500 dark:bg-dark-700 fixed inset-0 z-[110] flex flex-col overflow-hidden border-gray-200 bg-white transition-[opacity,transform] duration-200 sm:rounded-xl sm:border",
          expandido
            ? // Tela cheia, preservando só o sidebar: ele aparece a partir de
              // `xl` (ver `.sidebar-panel`), então abaixo disso a tela é toda
              // do chat. Sem arredondamento nem anel — é borda a borda.
              "sm:rounded-l-none sm:rounded-r-none sm:border-0 xl:ltr:left-(--sidebar-panel-width) xl:ltr:rounded-l-xl xl:rtl:right-(--sidebar-panel-width) xl:rtl:rounded-r-xl"
            : // Encaixado: coluna na direita com altura total, empurrando o
              // conteúdo. Arredondado só na borda que encontra o conteúdo — o
              // lado que encosta na borda da tela fica reto.
              // conteúdo (a margem vem da classe no `body`). Abaixo de `lg` a
              // base `fixed inset-0` já entrega a folha de tela cheia.
              "lg:inset-y-0 lg:m-0 lg:h-full lg:w-(--assistant-panel-width) lg:rounded-none lg:border-y-0 lg:ltr:right-0 lg:ltr:left-auto lg:ltr:rounded-l-xl lg:ltr:border-r-0 lg:ltr:border-l lg:rtl:right-auto lg:rtl:left-0 lg:rtl:rounded-r-xl lg:rtl:border-l-0 lg:rtl:border-r",
          visivel
            ? "translate-y-0 opacity-100"
            : "pointer-events-none invisible translate-y-2 opacity-0",
        )}
      >
        {/* Tooltip dos botões do cabeçalho. Fica aqui dentro, e não no
            <Tooltip/> global do Root: este painel é um portal com z-[110], e o
            tooltip de fora apareceria atrás dele. */}
        <Tooltip id={TOOLTIP_ID} place="bottom" />

        {/* Cabeçalho — mesmo desenho do cabeçalho das janelas de IA
            (IaModalShell): superfície neutra, borda inferior, título em
            gray-800 e ícone herdando a cor do título. A barra em gradiente
            primário que havia aqui era o que fazia o painel parecer um
            widget de outro produto sobreposto ao app. */}
        <div className="dark:border-dark-600 flex shrink-0 items-center gap-2.5 border-b border-gray-200 px-4 py-3">
          <div className="dark:text-dark-50 flex min-w-0 flex-1 items-center gap-2 text-gray-800">
            <ChatBubbleOvalLeftEllipsisIcon className="size-5 shrink-0" />
            <p className="truncate text-sm font-semibold">
              {t("chrome.assistantName")}
            </p>
          </div>
          <HeaderBtn
            icon={PlusIcon}
            label={t("chrome.assistantNew")}
            onClick={novaConversa}
            destaque
          />
          {/* Ampliar não aparece no celular: lá os dois modos são a mesma
              folha de tela cheia, então o botão não teria efeito visível. */}
          <HeaderBtn
            icon={expandido ? ArrowsPointingInIcon : ArrowsPointingOutIcon}
            label={
              expandido
                ? t("chrome.assistantCollapse")
                : t("chrome.assistantExpand")
            }
            onClick={() => setExpandido(!expandido)}
            className="max-sm:hidden"
            destaque
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
        <div className="dark:border-dark-600 flex shrink-0 border-b border-gray-200">
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
          <div className="dark:border-dark-600 dark:bg-dark-800/40 shrink-0 border-t border-gray-200 bg-gray-50/60 p-2.5">
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
                // text-base no celular: Safari dá zoom ao focar campos < 16px.
                className="dark:text-dark-100 max-h-[120px] flex-1 resize-none bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400 sm:text-sm"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={loading || !texto.trim()}
                title={t("chrome.assistantSend")}
                className="from-primary-600 to-primary-400 grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white transition-opacity disabled:opacity-40 sm:size-8"
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
  className,
  destaque = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  className?: string;
  /** Ações do assistente (nova conversa, ampliar) em outlined primário; os
      controles de janela (minimizar, fechar) seguem flat neutros. */
  destaque?: boolean;
}) {
  return (
    // `Button variant="flat" isIcon`, o mesmo dos controles de janela do
    // app (WindowControls). size-8 é o alvo padrão desses controles.
    <Button
      variant={destaque ? "outlined" : "flat"}
      color={destaque ? "primary" : "neutral"}
      isIcon
      onClick={onClick}
      // Tooltip do produto em vez do `title` nativo (que demora ~1s e usa o
      // estilo do sistema). `aria-label` segue para leitores de tela.
      data-tooltip-id={TOOLTIP_ID}
      data-tooltip-content={label}
      aria-label={label}
      className={clsx("size-8 rounded-lg", className)}
    >
      <Icon className="size-4.5" />
    </Button>
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
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="dark:bg-dark-500 dark:text-dark-200 shrink-0 rounded-full bg-gray-100 px-1.5 text-tiny text-gray-500">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
