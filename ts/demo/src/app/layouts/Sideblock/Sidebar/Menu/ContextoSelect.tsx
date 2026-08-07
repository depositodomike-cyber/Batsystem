/**
 * Select de contextos da organização aberta agora.
 *
 * Substitui o collapse "Contexto" na sidebar: lista só os contextos da
 * organização ativa. Trocar o valor abre aquele contexto.
 */

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  CheckIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { navigationIcons } from "@/app/navigation/icons";
import {
  usePrototipoContas,
  useRepositorioAtivo,
  useRepositoriosDoEscopoAtivo,
} from "@/app/pages/prototypes/contas/model/context";

export function ContextoSelect() {
  const { despachar } = usePrototipoContas();
  const { lgAndDown } = useBreakpointsContext();
  const { close } = useSidebarContext();
  const contextos = useRepositoriosDoEscopoAtivo();
  const ativo = useRepositorioAtivo();

  const Icon = navigationIcons["ceo.memoria"];
  const selecionado =
    contextos.find((contexto) => contexto.id === ativo?.id) ?? contextos[0];

  const abrir = (repositorioId: string) => {
    if (!repositorioId) return;
    despachar({
      tipo: "contexto/abrirRepositorio",
      payload: { repositorioId },
    });
    // Só troca o contexto ativo — a tela do grafo abre pelo item "Grafo".
    if (lgAndDown) close();
  };

  return (
    <Menu as="div" className="relative inline-flex w-full px-3">
      <MenuButton
        disabled={contextos.length === 0}
        className={clsx(
          "dark:hover:bg-dark-300/10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start outline-hidden transition-colors hover:bg-gray-100",
          "focus-visible:ring-primary-500/50 focus-visible:ring-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {Icon && (
          <Icon className="text-primary-600 dark:text-primary-400 size-5 shrink-0 stroke-[1.5]" />
        )}
        <span className="dark:text-dark-50 min-w-0 flex-1 truncate text-xs-plus font-semibold text-gray-800">
          {selecionado?.nome ?? "Nenhum contexto"}
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
          anchor={{ to: "bottom start", gap: 6 }}
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 w-56 rounded-lg border bg-white p-1 outline-hidden dark:shadow-none"
        >
          <p className="dark:text-dark-300 px-2.5 py-1 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
            Contextos
          </p>
          {contextos.map((contexto) => {
            const active = contexto.id === selecionado?.id;
            return (
              <MenuItem key={contexto.id}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => abrir(contexto.id)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-xs-plus outline-hidden transition-colors",
                      focus && "dark:bg-dark-600 bg-gray-100",
                      active
                        ? "text-primary-600 dark:text-primary-400 font-semibold"
                        : "dark:text-dark-100 text-gray-800",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {contexto.nome}
                    </span>
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
