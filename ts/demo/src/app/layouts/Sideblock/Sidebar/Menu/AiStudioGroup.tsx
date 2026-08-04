// Import Dependencies
import { useMemo } from "react";
import { NavLink } from "react-router";
import clsx from "clsx";

// Local Imports
import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { AiFunction, FUNCTIONS } from "@/app/pages/ceo/ia-functions";
import { GroupChevron } from "./GroupChevron";

// ----------------------------------------------------------------------
// AI Studio — bloco da sidebar que expõe as funções da tela de IA como
// subitens. Cada item navega para `/<produto>/ia?fn=<id>`, e a página de IA
// (Ia.tsx) abre o modal correspondente ao ler o parâmetro `fn`.
// ----------------------------------------------------------------------

function AiStudioItem({
  item,
  to,
  onNavigate,
}: {
  item: AiFunction;
  to: string;
  onNavigate: () => void;
}) {
  const { label, Icon, tint } = item;
  return (
    <div className="relative flex px-3">
      <NavLink
        to={to}
        onClick={onNavigate}
        className="group dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 dark:focus:bg-dark-300/10 min-w-0 flex-1 rounded-md px-3 py-1 font-medium text-gray-800 outline-hidden transition-colors ease-in-out hover:bg-gray-100 hover:text-gray-950 focus:bg-gray-100 focus:text-gray-950"
      >
        <div className="flex min-w-0 items-center gap-2.5 text-xs tracking-wide">
          <Icon
            className={clsx(
              "size-4.5 shrink-0 stroke-[1.5] opacity-80 group-hover:opacity-100",
              tint,
            )}
          />
          <span className="truncate">{label}</span>
        </div>
      </NavLink>
    </div>
  );
}

export function AiStudioGroup({ product }: { product: string }) {
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();

  const handleItemClick = () => lgAndDown && closeSidebar();
  const itemPath = (id: string) => `/${product}/ia?fn=${id}`;

  // Subitens em ordem alfabética (ignorando acentos/caixa); a ordem do
  // catálogo é preservada para os cards da tela de IA.
  const items = useMemo(
    () =>
      [...FUNCTIONS].sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
      ),
    [],
  );

  return (
    <div className="pt-3">
      <div
        className={clsx(
          "sticky top-0 z-10 bg-white px-6",
          cardSkin === "bordered" ? "dark:bg-dark-900" : "dark:bg-dark-750",
        )}
      >
        {/* Cabeçalho: o chevron recolhe/expande o grupo e o rótulo "AI Studio"
            navega para a tela de IA (/<produto>/ia). */}
        <div className="mb-1.5 flex w-full items-center gap-2 pt-2 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
          <button
            type="button"
            onClick={toggle}
            aria-label={isOpened ? "Recolher AI Studio" : "Expandir AI Studio"}
            className="dark:text-dark-300 dark:hover:text-dark-50 dark:focus:text-dark-50 flex cursor-pointer items-center outline-hidden hover:text-gray-900 focus:text-gray-900"
          >
            <GroupChevron open={isOpened} />
          </button>
          <NavLink
            to={`/${product}/ia`}
            onClick={handleItemClick}
            className="dark:text-dark-300 dark:hover:text-dark-50 dark:focus:text-dark-50 min-w-0 flex-1 cursor-pointer truncate outline-hidden hover:text-gray-900 focus:text-gray-900"
          >
            AI Studio
          </NavLink>
        </div>
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-linear-to-b from-white to-transparent",
            cardSkin === "bordered" ? "dark:from-dark-900" : "dark:from-dark-750",
          )}
        ></div>
      </div>

      <Collapse in={isOpened}>
        <div className="flex flex-col space-y-0.5">
          {items.map((item) => (
            <AiStudioItem
              key={item.id}
              item={item}
              to={itemPath(item.id)}
              onNavigate={handleItemClick}
            />
          ))}
        </div>
      </Collapse>
    </div>
  );
}
