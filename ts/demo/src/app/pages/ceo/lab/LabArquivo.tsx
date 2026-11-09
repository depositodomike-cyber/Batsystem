import {
  ArrowUpTrayIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useRef } from "react";

/**
 * Anexo de um arquivo numa etapa do Lab: botão "Carregar arquivo" e, depois de
 * escolhido, o chip com o nome e o "×" para remover — o mesmo desenho do anexo
 * de Apresentação.
 */
export function LabArquivo({
  arquivo,
  onChange,
  accept,
  rotulo = "Carregar arquivo",
}: {
  arquivo: File | null;
  onChange: (f: File | null) => void;
  accept?: string;
  rotulo?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          // Permite escolher o mesmo arquivo de novo depois de remover.
          e.target.value = "";
        }}
      />
      {arquivo ? (
        <div className="dark:border-dark-600 dark:bg-dark-800/40 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
          <PaperClipIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
          <span className="dark:text-dark-100 text-xs-plus min-w-0 flex-1 truncate text-gray-700">
            {arquivo.name}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remover ${arquivo.name}`}
            className="dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-100 grid size-6 shrink-0 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="dark:border-dark-450 dark:text-dark-100 dark:hover:border-dark-400 text-xs-plus inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:border-gray-400"
        >
          <ArrowUpTrayIcon className="size-4" />
          {rotulo}
        </button>
      )}
    </div>
  );
}
