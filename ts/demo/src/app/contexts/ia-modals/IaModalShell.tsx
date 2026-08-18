// Casca compartilhada das janelas de IA.
//
// Antes esta estrutura era copiada literalmente em 15 arquivos, variando só o
// `max-w-*` e o `max-h-[NNvh]`. Além da duplicação, a cópia tinha dois defeitos:
//
// 1. `fixed inset-0 overflow-y-auto` no wrapper + `max-h-[NNvh]` no corpo criava
//    DOIS scrollers aninhados. Com `vh` (não `dvh`), em 375px com a barra de URL
//    visível o rodapé do formulário ficava inalcançável: o usuário rolava o
//    scroller externo achando que rolava o conteúdo.
// 2. Nenhuma variante mobile — um card de `max-w-3xl` com margem em 375px.
//
// Aqui o corpo é o único scroller (`min-h-0 flex-1 overflow-y-auto`, o padrão
// que já existia em `ceo/SidePanel.tsx`), e no celular a janela é uma folha de
// tela cheia.
import { ReactNode } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import clsx from "clsx";

import { WindowControls } from "./WindowControls";

// ----------------------------------------------------------------------

export type IaModalSize = "2xl" | "3xl" | "4xl";

const LARGURA: Record<IaModalSize, string> = {
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
};

interface IaModalShellProps {
  isOpen: boolean;
  /** Fecha a janela (desmonta e reseta o estado interno). */
  close: () => void;
  /** Recolhe para o dock do rodapé, preservando o estado. */
  onMinimize?: () => void;
  title: ReactNode;
  icon?: React.ElementType;
  /**
   * Bloqueia o fechamento (usado durante a geração). Vale também para ESC e
   * clique no backdrop, não só para o botão — antes o `closeDisabled` só
   * desabilitava o botão e o `Dialog` fechava por ESC de qualquer forma.
   */
  closeDisabled?: boolean;
  /**
   * `false` = só o botão de fechar encerra; clique fora e Escape nunca fecham.
   * Use quando descartar por acidente perderia trabalho (ex.: um upload em
   * andamento).
   */
  dismissable?: boolean;
  /**
   * Mantém a janela montada quando fechada, preservando o estado interno.
   * Corresponde ao `unmount={false}` do Transition.
   */
  keepMounted?: boolean;
  /** Largura máxima no desktop. No celular a janela é sempre tela cheia. */
  size?: IaModalSize;
  /**
   * Faixa fixa entre o cabeçalho e o corpo, que **não** rola com o conteúdo —
   * para abas, como no Upload. Se fosse parte de `children`, sairia da tela ao
   * rolar o formulário.
   */
  belowHeader?: ReactNode;
  /** Classe extra no corpo (ex.: remover o padding padrão). */
  bodyClassName?: string;
  children: ReactNode;
}

export function IaModalShell({
  isOpen,
  close,
  onMinimize,
  title,
  icon: Icon,
  closeDisabled = false,
  dismissable = true,
  keepMounted = false,
  size = "3xl",
  belowHeader,
  bodyClassName,
  children,
}: IaModalShellProps) {
  return (
    <Transition show={isOpen} unmount={!keepMounted}>
      <Dialog
        onClose={!dismissable || closeDisabled ? () => {} : close}
        className="relative z-[70]"
      >
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-black/40" />
        </TransitionChild>

        {/* Sem `overflow-y-auto` aqui: quem rola é o corpo. */}
        <div className="fixed inset-0 flex items-start justify-center sm:p-6">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <DialogPanel
              className={clsx(
                "dark:bg-dark-700 flex w-full flex-col bg-white shadow-xl",
                // Celular: folha de tela cheia.
                "h-[100dvh] max-h-[100dvh]",
                // Desktop: card com altura limitada pelo viewport dinâmico.
                "sm:my-0 sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-xl",
                LARGURA[size],
              )}
            >
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 sm:px-5 sm:py-3.5">
                <DialogTitle className="dark:text-dark-50 flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-800 sm:text-base">
                  {Icon && <Icon className="size-5 shrink-0" />}
                  <span className="truncate">{title}</span>
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={close}
                  closeDisabled={closeDisabled}
                />
              </div>

              {belowHeader && <div className="shrink-0">{belowHeader}</div>}

              <div
                className={clsx(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5",
                  bodyClassName,
                )}
              >
                {children}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
