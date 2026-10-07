// Import Dependencies
import { useState } from "react";
import { FolderIcon } from "@heroicons/react/24/outline";

// Local Imports
import { PastaLocalModal } from "@/app/pages/ceo/PastaLocalModal";

// ----------------------------------------------------------------------
// Acesso à Pasta local do PROTÓTIPO, no rodapé da sidebar.
//
// Secundário de propósito: a pasta Markdown existe por limitação do protótipo
// e não é o "Repositório" do produto (que mora em Configurações → Repositório).
// Por isso fica fora do menu, com texto esmaecido, e abre um modal em vez de
// navegar.

export function PastaLocalButton() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="dark:border-dark-600/80 shrink-0 border-t border-gray-200 px-3 py-2">
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-tooltip
        data-tooltip-content="Pasta local do protótipo"
        data-tooltip-place="right"
        className="group dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-100 dark:focus:bg-dark-300/10 flex w-full min-w-0 items-center gap-2.5 rounded-md px-3 py-1.5 text-start text-xs font-medium tracking-wide text-gray-500 outline-hidden transition-colors ease-in-out hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100"
      >
        <FolderIcon className="size-4.5 shrink-0 stroke-[1.5] opacity-80 group-hover:opacity-100" />
        <span className="truncate">Pasta local</span>
      </button>

      <PastaLocalModal isOpen={aberto} close={() => setAberto(false)} />
    </div>
  );
}
