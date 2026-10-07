// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { FolderIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { PastaLocalPanel } from "./PastaLocalPanel";

// ----------------------------------------------------------------------
// Modal da Pasta local, aberto pelo rodapé da sidebar. Mesmo casco de modal
// de Documentos (NewFolderModal): Headless UI Dialog + TransitionChild.

export function PastaLocalModal({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <Transition show={isOpen} appear>
      <Dialog open={isOpen} onClose={close} className="relative z-100">
        <TransitionChild
          as="div"
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
        />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto p-4">
          <TransitionChild
            as={DialogPanel}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
            className="dark:bg-dark-800 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="dark:text-dark-200 grid size-10 shrink-0 place-items-center rounded-xl bg-gray-900/5 text-gray-500 dark:bg-white/5">
                  <FolderIcon className="size-5" />
                </span>
                <div>
                  <DialogTitle
                    as="h3"
                    className="dark:text-dark-50 text-base font-semibold text-gray-800"
                  >
                    Pasta local
                  </DialogTitle>
                  <p className="dark:text-dark-300 text-tiny-plus text-gray-500">
                    Selecione a pasta local utilizada como fonte de arquivos
                    pelo protótipo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="dark:text-dark-300 dark:hover:bg-dark-600 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />

            <PastaLocalPanel />
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
