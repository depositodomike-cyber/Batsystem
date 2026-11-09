import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { MemoriaInput } from "@/components/shared/MemoriaMentions";
import { Button, Spinner } from "@/components/ui";

import { CAMPO } from "./estilos";

/**
 * "Peça um ajuste": refino iterativo do resultado em português — a IA refaz
 * preservando o que já estava bom. Comum a Artigo, Carrossel e Dashboard.
 */
export function LabAjuste({
  valor,
  onChange,
  onRefazer,
  refinando,
  placeholder = "Ex.: mais curto, mais formal, foque em exemplos práticos…",
}: {
  valor: string;
  onChange: (v: string) => void;
  onRefazer: () => void;
  refinando: boolean;
  placeholder?: string;
}) {
  return (
    <div className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-4">
      <label className="dark:text-dark-100 mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <SparklesIcon className="size-4" /> Peça um ajuste
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <MemoriaInput
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !refinando && valor.trim()) onRefazer();
          }}
          disabled={refinando}
          placeholder={placeholder}
          className={`${CAMPO} min-w-0 flex-1 rounded-lg`}
        />
        <Button
          type="button"
          onClick={onRefazer}
          color="primary"
          disabled={!valor.trim() || refinando}
          className="h-10 gap-2 px-5"
        >
          {refinando ? (
            <Spinner className="size-4" />
          ) : (
            <ArrowPathIcon className="size-4" />
          )}
          Refazer
        </Button>
      </div>
    </div>
  );
}
