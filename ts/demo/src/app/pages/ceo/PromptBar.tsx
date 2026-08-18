// Import Dependencies
import { useState, type KeyboardEvent } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";

// ----------------------------------------------------------------------

/**
 * Editor de texto fixo na parte inferior das páginas de conversa.
 * Estética compartilhada entre Squad, Grupo e Conversa (histórico).
 */
export function PromptBar({
  placeholder,
  hint,
  onSubmit,
}: {
  placeholder: string;
  hint: string;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setValue("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    // `px-(--margin-x)` em vez de `p-4` fixo: alinha com o conteúdo acima, que
    // usa o mesmo token (16px < 768px, 24px até 1535px, 48px acima).
    <div className="shrink-0 px-(--margin-x) py-4">
      <div className="dark:border-dark-500 dark:bg-dark-700 focus-within:border-primary-400 mx-auto flex max-w-3xl flex-col rounded-lg border border-gray-300 bg-white transition-colors">
        <MemoriaTextarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder={placeholder}
          className="dark:text-dark-100 dark:placeholder:text-dark-300 w-full resize-none bg-transparent px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400"
        />
        <div className="flex items-center gap-2 px-2 py-2">
          {/* `min-w-0` + `truncate`: um hint longo ("Pergunte ao squad …")
              empurrava o botão Enviar para fora da caixa em telas estreitas. */}
          <span className="dark:text-dark-400 ml-2 min-w-0 truncate text-xs text-gray-500">
            → {hint}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="dark:text-dark-400 hidden font-mono text-xs text-gray-400 sm:inline">
              ⌘↵ enviar
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              className="bg-primary-500 hover:bg-primary-600 dark:disabled:bg-dark-500 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              <PaperAirplaneIcon className="size-3.5" />
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
