// "Adicionar" no cabeçalho do Repositório (Grafo e Lista): as formas de trazer
// conteúdo — o Upload que já existe e o Google Drive. Mesmo Menu/estilo do
// seletor de visualização ao lado (RepositorioViewSelect).

import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { ArrowUpTrayIcon, ChevronDownIcon, CloudIcon, PlusIcon, Square2StackIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

import { useIaModals } from "@/app/contexts/ia-modals/context";
import { isConnectorTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";
import { ImportarDoDrive } from "./ImportarDoDrive";
import { ImportarNotasAutoadesivas } from "../notas-autoadesivas/ImportarNotasAutoadesivas";

export function AdicionarAoRepositorio() {
  const { open } = useIaModals();
  const [drive, setDrive] = useState(false);
  const [sticky, setSticky] = useState(false);

  const itens = [
    {
      id: "upload",
      rotulo: "Upload de arquivo",
      descricao: "Documento, áudio ou transcrição",
      Icon: ArrowUpTrayIcon,
      acao: () => open("upload"),
    },
    ...(isConnectorTemporarilyDisabled("google-drive")
      ? []
      : [
          {
            id: "drive",
            rotulo: "Google Drive",
            descricao: "Arquivos e pastas da sua conta",
            Icon: CloudIcon,
            acao: () => setDrive(true),
          },
        ]),
    {
      id: "notas-autoadesivas",
      rotulo: "Notas Autoadesivas",
      descricao: "Importar do app do Windows, sem IA",
      Icon: Square2StackIcon,
      acao: () => setSticky(true),
    },
  ];

  return (
    <>
      <Menu as="div" className="relative inline-flex">
        <MenuButton
          aria-label="Adicionar ao Repositório"
          className={clsx(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-800 outline-hidden transition-colors",
            "dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 dark:hover:bg-dark-600 hover:bg-gray-50",
            "focus-visible:ring-primary-500/50 focus-visible:ring-2",
          )}
        >
          <PlusIcon className="size-4 shrink-0" />
          Adicionar
          <ChevronDownIcon className="dark:text-dark-300 size-3.5 shrink-0 text-gray-400" />
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
            className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 w-60 rounded-lg border bg-white p-1 outline-hidden dark:shadow-none"
          >
            <p className="dark:text-dark-300 text-tiny-plus px-2.5 py-1 font-semibold tracking-wider text-gray-400 uppercase">
              Adicionar ao Repositório
            </p>
            {itens.map((item) => (
              <MenuItem key={item.id}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={item.acao}
                    className={clsx(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-start outline-hidden transition-colors",
                      focus && "dark:bg-dark-600 bg-gray-100",
                    )}
                  >
                    <item.Icon className="dark:text-dark-200 mt-0.5 size-4 shrink-0 stroke-[1.5] text-gray-600" />
                    <span className="min-w-0">
                      <span className="text-xs-plus dark:text-dark-100 block font-medium text-gray-800">
                        {item.rotulo}
                      </span>
                      <span className="dark:text-dark-300 block text-[11px] text-gray-500">{item.descricao}</span>
                    </span>
                  </button>
                )}
              </MenuItem>
            ))}
          </MenuItems>
        </Transition>
      </Menu>
      <ImportarDoDrive aberto={drive} onClose={() => setDrive(false)} />
      <ImportarNotasAutoadesivas aberto={sticky} onClose={() => setSticky(false)} />
    </>
  );
}
