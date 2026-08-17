/**
 * Select Grafo / Lista no cabeçalho do Repositório. Mesmo padrão do sidebar
 * (ícone, rótulo, chevron e menu), com borda para conviver com o Sincronizar.
 */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { navigationIcons } from "@/app/navigation/icons";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

export type RepositorioView = "lista" | "grafo";

const VIEW_KEY = "ceo-os:repositorio-view";

const VIEWS: {
  id: RepositorioView;
  label: string;
  icon: "ceo.contexto-lista" | "ceo.grafo";
}[] = [
  { id: "grafo", label: "Grafo", icon: "ceo.grafo" },
  { id: "lista", label: "Lista", icon: "ceo.contexto-lista" },
];

const SLUG: Record<RepositorioView, string> = {
  lista: "memoria-lista",
  grafo: "memoria-grafo",
};

export function viewDoPath(pathname: string): RepositorioView {
  return /\/memoria-grafo\/?$/.test(pathname) ? "grafo" : "lista";
}

export function ehPaginaRepositorio(pathname: string): boolean {
  return /\/memoria-(lista|grafo)\/?$/.test(pathname);
}

export function lerViewRepositorio(): RepositorioView {
  if (isFeatureTemporarilyDisabled("memoryGraph")) return "lista";
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "lista" || v === "grafo") return v;
  } catch {
    /* modo privado */
  }
  return "grafo";
}

export function salvarViewRepositorio(view: RepositorioView): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* modo privado */
  }
}

export function caminhoRepositorio(product: string, view?: RepositorioView): string {
  const escolhida = view ?? lerViewRepositorio();
  const efetiva =
    escolhida === "grafo" && isFeatureTemporarilyDisabled("memoryGraph")
      ? "lista"
      : escolhida;
  return `/${product}/${SLUG[efetiva]}`;
}

export function RepositorioViewSelect({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const product = getCurrentProduct(pathname);
  const grafoOff = isFeatureTemporarilyDisabled("memoryGraph");
  const atual = viewDoPath(pathname);

  useEffect(() => {
    if (!grafoOff) salvarViewRepositorio(atual);
  }, [atual, grafoOff]);

  if (grafoOff) return null;

  const selecionado = VIEWS.find((v) => v.id === atual) ?? VIEWS[0];
  const Icon = navigationIcons[selecionado.icon];

  const escolher = (view: RepositorioView) => {
    if (view === atual) return;
    salvarViewRepositorio(view);
    navigate(caminhoRepositorio(product.code, view));
  };

  return (
    <Menu as="div" className="relative inline-flex">
      <MenuButton
        aria-label="Visualização"
        className={clsx(
          "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white text-start outline-hidden transition-colors",
          "dark:border-dark-450 dark:bg-dark-700 dark:hover:bg-dark-600 hover:bg-gray-50",
          "focus-visible:ring-primary-500/50 focus-visible:ring-2",
          compact ? "h-8 px-2.5 text-xs" : "h-8 px-3 text-xs-plus",
        )}
      >
        {Icon && (
          <Icon className="dark:text-dark-300 size-4 shrink-0 stroke-[1.5] text-gray-500" />
        )}
        <span className="dark:text-dark-100 min-w-0 font-medium text-gray-800">
          {selecionado.label}
        </span>
        <ChevronUpDownIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
      </MenuButton>

      <Transition
        enter="transition ease-out"
        enterFrom="translate-y-1 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transition ease-in"
        leaveFrom="translate-y-0 opacity-100"
        leaveTo="translate-y-1 opacity-0"
      >
        <MenuItems
          anchor={{ to: "bottom end", gap: 6 }}
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 w-48 rounded-lg border bg-white p-1 outline-hidden dark:shadow-none"
        >
          <p className="dark:text-dark-300 px-2.5 py-1 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
            Visualização
          </p>
          {VIEWS.map((view) => {
            const active = view.id === selecionado.id;
            const ViewIcon = navigationIcons[view.icon];
            return (
              <MenuItem key={view.id}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => escolher(view.id)}
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
