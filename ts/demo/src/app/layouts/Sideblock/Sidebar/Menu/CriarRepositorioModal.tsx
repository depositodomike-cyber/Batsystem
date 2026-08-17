/**
 * Modal simples para criar um repositório vazio no escopo atual.
 * A pasta física continua sendo vinculada depois (Lista / Configurações).
 */

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState, type FormEvent } from "react";

import { Button, Input } from "@/components/ui";
import { usePrototipoContas } from "@/app/pages/prototypes/contas/model/context";

interface Props {
  isOpen: boolean;
  close: () => void;
}

function Formulario({ close }: { close: () => void }) {
  const { despachar } = usePrototipoContas();
  const [nome, setNome] = useState("");
  const podeCriar = nome.trim().length > 0;

  const criar = (e: FormEvent) => {
    e.preventDefault();
    if (!podeCriar) return;
    despachar({
      tipo: "repositorio/criar",
      payload: { nome: nome.trim() },
    });
    close();
  };

  return (
    <form onSubmit={criar} className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <Input
        label="Nome do repositório"
        placeholder="Digite o nome do repositório"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outlined" onClick={close}>
          Cancelar
        </Button>
        <Button type="submit" color="primary" disabled={!podeCriar}>
          Criar repositório
        </Button>
      </div>
    </form>
  );
}

export function CriarRepositorioModal({ isOpen, close }: Props) {
  return (
    <Transition
      appear
      show={isOpen}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={close}
    >
      <TransitionChild
        as="div"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity dark:bg-black/50"
      />

      <TransitionChild
        as={DialogPanel}
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
        className="dark:bg-dark-700 relative flex w-full max-w-md origin-top flex-col rounded-lg bg-white transition-all duration-300"
      >
        <div className="dark:border-dark-600 flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-5">
          <DialogTitle
            as="h3"
            className="dark:text-dark-100 text-base font-medium text-gray-800"
          >
            Criar novo repositório
          </DialogTitle>
          <Button
            onClick={close}
            variant="flat"
            isIcon
            className="size-7 rounded-lg"
            aria-label="Fechar"
          >
            <XMarkIcon className="size-4.5" />
          </Button>
        </div>

        {isOpen ? <Formulario close={close} /> : null}
      </TransitionChild>
    </Transition>
  );
}
