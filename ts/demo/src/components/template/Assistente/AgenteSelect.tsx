// Botão "@ Agentes" no topo do campo de envio: lista os agentes mencionáveis
// (do sistema e do usuário) e, ao escolher um, insere "@Menção " no campo —
// o mesmo efeito de digitar "@" e escolher no autocomplete. Não há "agente
// ativo": o agente participa da mensagem em que foi mencionado.
//
// O menu é o mesmo padrão de Menu/anchor do app (SalvarNaMemoria), com
// z-[120] porque o painel do assistente é z-[110] e o menu ancorado vai para
// um portal.
import { Fragment } from "react";
import { useNavigate } from "react-router";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSeparator,
  Transition,
} from "@headlessui/react";
import { AtSymbolIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

import { useAssistente } from "@/app/contexts/assistente/context";
import {
  useAgentes,
  type AgenteMencionavel,
} from "@/app/contexts/agentes/context";
import { userSettingsPath } from "@/app/navigation/ceoOs";
import { SQUADS_PRODUCT_CODE } from "@/app/navigation/ceoOs";
import { AgenteAvatar } from "@/components/shared/AgenteAvatar";

// ----------------------------------------------------------------------

/** "Gerenciar agentes": Configurações de usuário → Agentes. */
export const ROTA_AGENTES = userSettingsPath(SQUADS_PRODUCT_CODE, "agentes");

const ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs-plus transition-colors";

export function AgenteSelect({ disabled }: { disabled?: boolean }) {
  const navigate = useNavigate();
  const { inserirMencao, minimize } = useAssistente();
  const { sistema, meus } = useAgentes();

  if (sistema.length === 0 && meus.length === 0) return null;

  const item = (agente: AgenteMencionavel) => (
    <MenuItem key={agente.id}>
      {({ focus }) => (
        <button
          type="button"
          onClick={() => inserirMencao(agente)}
          className={clsx(
            ITEM_CLASS,
            focus
              ? "dark:bg-dark-600 dark:text-dark-50 bg-gray-100 text-gray-900"
              : "dark:text-dark-100 text-gray-700",
          )}
        >
          <AgenteAvatar titulo={agente.titulo} icone={agente.icone} />
          <span className="min-w-0 flex-1 truncate">{agente.titulo}</span>
          <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
            @{agente.mencao}
          </span>
        </button>
      )}
    </MenuItem>
  );

  const cabecalho = (texto: string) => (
    <p className="dark:text-dark-300 text-tiny px-3 pt-1.5 pb-1 font-semibold tracking-wide text-gray-400 uppercase">
      {texto}
    </p>
  );

  return (
    <Menu as="div" className="relative min-w-0">
      <MenuButton
        disabled={disabled}
        className="dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-100 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
      >
        <AtSymbolIcon className="size-3.5 shrink-0" />
        <span className="truncate">Agentes</span>
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <MenuItems
          anchor={{ to: "top start", gap: 6 }}
          className="dark:border-dark-500 dark:bg-dark-750 z-[120] max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
        >
          {sistema.length > 0 && cabecalho("Agentes do sistema")}
          {sistema.map(item)}
          {meus.length > 0 && cabecalho("Meus agentes")}
          {meus.map(item)}
          <MenuSeparator className="dark:bg-dark-500 my-1 h-px bg-gray-200" />
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={() => {
                  // A página cobre o painel encaixado no celular; minimizar
                  // mantém a conversa e o rascunho.
                  minimize();
                  navigate(ROTA_AGENTES);
                }}
                className={clsx(
                  ITEM_CLASS,
                  focus
                    ? "dark:bg-dark-600 dark:text-dark-50 bg-gray-100 text-gray-900"
                    : "dark:text-dark-200 text-gray-600",
                )}
              >
                <Cog6ToothIcon className="size-4 shrink-0 stroke-[1.5] opacity-80" />
                <span className="min-w-0 flex-1 truncate">Gerenciar agentes</span>
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Transition>
    </Menu>
  );
}
