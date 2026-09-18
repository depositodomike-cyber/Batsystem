// Import Dependencies
import { ReactNode } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import {
  AccordionButton,
  AccordionItem,
  AccordionPanel,
} from "@/components/ui";

// ----------------------------------------------------------------------
// Moldura de uma etapa do wizard de "Criar apresentação".
//
// Só apresentação: quem guarda o estado é a tela. Aqui mora o cabeçalho
// (número/ícone, título, resumo, "Editar") e o corpo colapsável.
//
// O cabeçalho É o botão do accordion — clicar em qualquer ponto abre a etapa.
// Por isso o "Editar" é um <span> com cara de link, e não um <button>: um botão
// dentro de outro é HTML inválido e criaria dois alvos de foco para a mesma
// ação.
//
// O `AccordionPanel` usa `Collapse` por baixo, que NÃO desmonta o conteúdo
// fechado. É o que preserva valores, posição do cursor e o cache de menções do
// MemoriaTextarea ao recolher uma etapa — não trocar por renderização
// condicional nem passar `transitionDuration={0}` (o único caminho que
// desmonta).
// ----------------------------------------------------------------------

export type EtapaStatus = "ativa" | "concluida" | "pendente";

interface Props {
  /** Valor do item no accordion. */
  id: string;
  /** "01".."05" — some quando a etapa está concluída, dando lugar ao check. */
  numero: string;
  titulo: string;
  status: EtapaStatus;
  /** Linha compacta com as escolhas da etapa (só quando concluída). */
  resumo?: string;
  /** Texto de baixa ênfase da etapa pendente ("A seguir", "Opcional"). */
  pendenteLabel?: string;
  /** Recebe o nó do card, para o scroll suave ao avançar. */
  innerRef?: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}

export function ApresentacaoEtapa({
  id,
  numero,
  titulo,
  status,
  resumo,
  pendenteLabel,
  innerRef,
  children,
}: Props) {
  const ativa = status === "ativa";
  const concluida = status === "concluida";

  return (
    <AccordionItem
      value={id}
      ref={innerRef}
      className={clsx(
        "rounded-2xl border transition-colors",
        ativa
          ? "border-primary-500 dark:bg-dark-700 bg-white"
          : concluida
            ? "dark:border-dark-600 dark:bg-dark-700 border-gray-200 bg-white"
            : // Pendente é baixa ênfase, não desabilitada: continua clicável e
              // focável, só não disputa atenção com a etapa ativa.
              "dark:border-dark-600/60 border-gray-200 bg-transparent",
      )}
    >
      <AccordionButton className="focus-visible:ring-primary-500/50 flex w-full cursor-pointer items-center gap-3 rounded-2xl px-5 py-4 text-start outline-hidden focus-visible:ring-2 sm:px-6">
        <span
          className={clsx(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
            concluida
              ? // Slate sobre amber é a regra da marca (mesma do botão
                // primário) — branco sobre amber não tem contraste.
                "bg-primary-500 text-slate-900"
              : ativa
                ? "bg-primary-500 text-slate-900"
                : "dark:border-dark-500 dark:text-dark-300 border-2 border-gray-200 text-gray-400",
          )}
        >
          {concluida ? (
            <CheckIcon className="size-4" strokeWidth="2.5" />
          ) : (
            numero
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={clsx(
              "block text-sm font-semibold",
              ativa || concluida
                ? "dark:text-dark-100 text-gray-800"
                : "dark:text-dark-300 text-gray-500",
            )}
          >
            {titulo}
          </span>
          {concluida && resumo && (
            <span className="dark:text-dark-300 mt-0.5 block truncate text-sm text-gray-500">
              {resumo}
            </span>
          )}
          {status === "pendente" && pendenteLabel && (
            <span className="dark:text-dark-300 mt-0.5 block text-sm text-gray-400">
              {pendenteLabel}
            </span>
          )}
        </span>

        {concluida && (
          <span className="text-primary-600 dark:text-primary-400 text-xs-plus shrink-0 font-medium">
            Editar
          </span>
        )}
      </AccordionButton>

      <AccordionPanel className="px-5 pb-5 sm:px-6 sm:pb-6">
        {children}
      </AccordionPanel>
    </AccordionItem>
  );
}
