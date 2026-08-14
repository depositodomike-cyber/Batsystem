/**
 * Select de visualização do Repositório: Lista ou Grafo.
 * Substitui os itens de menu irmãos — a área é uma só; isto só troca o modo.
 */

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useLocation, useNavigate } from "react-router";

import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";
import { navigationIcons } from "@/app/navigation/icons";

type ViewId = "lista" | "grafo";

const VIEWS: {
  id: ViewId;
  label: string;
  slug: string;
  icon: "ceo.contexto-lista" | "ceo.grafo";
}[] = [
  { id: "lista", label: "Lista", slug: "memoria-lista", icon: "ceo.contexto-lista" },
  { id: "grafo", label: "Grafo", slug: "memoria-grafo", icon: "ceo.grafo" },
];

export function VisualizacaoSelect({ product }: { product: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { lgAndDown } = useBreakpointsContext();
  const { close } = useSidebarContext();
  const grafoOff = isFeatureTemporarilyDisabled("memoryGraph");

  const opcoes = grafoOff ? VIEWS.filter((v) => v.id === "lista") : VIEWS;
  const atual: ViewId = /\/memoria-grafo\/?$/.test(pathname)
    ? "grafo"
    : "lista";
  const selecionado =
    opcoes.find((v) => v.id === atual) ?? opcoes[0];
  const naArea = /\/memoria-(lista|grafo)\/?$/.test(pathname);
  const Icon = navigationIcons[selecionado.icon];

  if (opcoes.length < 2) return null;

  const abrir = (view: (typeof VIEWS)[number]) => {
    navigate(`/${product}/${view.slug}`);
    if (lgAndDown) close();
  };

  return (
    <Menu as="div" className="relative flex w-full px-3">
      <MenuButton
        className={clsx(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start outline-hidden transition-colors",
          "focus-visible:ring-primary-500/50 focus-visible:ring-2",
          naArea
            ? "text-primary-600 dark:text-primary-400"
            : "dark:hover:bg-dark-300/10 hover:bg-gray-100",
        )}
      >
        {Icon && (
          <Icon
            className={clsx(
              "size-5 shrink-0 stroke-[1.5]",
              naArea
                ? "text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-dark-300",
            )}
          />
        )}
        <span
          className={clsx(
            "min-w-0 flex-1 truncate text-xs-plus font-semibold",
            naArea
              ? "text-primary-600 dark:text-primary-400"
              : "dark:text-dark-50 text-gray-800",
          )}
        >
          {selecionado.label}
        </span>
        <ChevronUpDownIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
      </MenuButton>
      {naArea && (
        <div className="bg-primary-600 dark:bg-primary-400 absolute bottom-1 top-1 w-1 ltr:left-0 ltr:rounded-r-full rtl:right-0 rtl:rounded-l-lg" />
      )}

      <Transition
        enter="transition ease-out"
        enterFrom="translate-y-1 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transition ease-in"
        leaveFrom="translate-y-0 opacity-100"
        leaveTo="translate-y-1 opacity-0"
      >
        <MenuItems
          anchor={{ to: "bottom start", gap: 6 }}
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 w-56 rounded-lg border bg-white p-1 outline-hidden dark:shadow-none"
        >
          <p className="dark:text-dark-300 px-2.5 py-1 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
            Visualização
          </p>
          {opcoes.map((view) => {
            const active = view.id === selecionado.id && naArea;
            const ViewIcon = navigationIcons[view.icon];
            return (
              <MenuItem key={view.id}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => abrir(view)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-xs-plus outline-hidden transition-colors",
                      focus && "dark:bg-dark-600 bg-gray-100",
                      active
                        ? "text-primary-600 dark:text-primary-400 font-semibold"
                        : "dark:text-dark-100 text-gray-800",
                    )}
                  >
                    {ViewIcon && (
                      <ViewIcon className="size-4 shrink-0 stroke-[1.5]" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{view.label}</span>
                    {active && <CheckIcon className="size-4 shrink-0" />}
                  </button>
                )}
              </MenuItem>
            );
          })}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
