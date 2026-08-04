// Import Dependencies
import { useState } from "react";
import { CommandLineIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { DesignSystemEditor } from "./DesignSystemEditor";
import { useActiveDesignSystem, useDesignSystems } from "./useDesignSystem";

// ----------------------------------------------------------------------
// Barra de marca / design system — portada do beculture/Confi (ia.js,
// `dsBarHTML` + `wireDSBar`). Aparece em TODAS as ferramentas do AI Studio:
// escolher a marca ativa, criar uma nova ou editar a selecionada. A marca
// escolhida vale para a ação em curso (e fica salva como a marca ativa).
// ----------------------------------------------------------------------

interface Props {
  className?: string;
}

export function DesignSystemBar({ className }: Props) {
  const { brands, activeId, setActive, criar } = useDesignSystems();
  const ds = useActiveDesignSystem();
  const [editando, setEditando] = useState(false);

  const novaMarca = () => {
    criar(); // cria a partir do padrão e já a torna ativa
    setEditando(true);
  };

  return (
    <>
      <div
        className={clsx(
          "dark:border-dark-600 dark:bg-dark-800/40 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2",
          className,
        )}
      >
        <div className="min-w-[180px] flex-1">
          <label className="dark:text-dark-300 mb-1 flex items-center gap-1.5 text-tiny-plus font-medium uppercase tracking-wider text-gray-500">
            <span
              className="size-3 shrink-0 rounded-full border border-black/10"
              style={{ background: ds.cores.primaria }}
              title={`Cor primária ${ds.cores.primaria}`}
            />
            Marca · design system
          </label>
          <select
            value={activeId}
            onChange={(e) => setActive(e.target.value)}
            aria-label="Marca / design system"
            className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={novaMarca}
            title="Criar uma marca / design system"
            className="dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs-plus font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            <PlusIcon className="size-4" /> Nova
          </button>
          <button
            type="button"
            onClick={() => setEditando(true)}
            title="Editar o design system da marca selecionada"
            className="dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs-plus font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            <CommandLineIcon className="size-4" /> Editar
          </button>
        </div>
      </div>

      {/* Montado só quando abre, com `key` na marca: o editor sempre parte do
          estado salvo da marca selecionada. */}
      {editando && (
        <DesignSystemEditor
          key={activeId}
          brandId={activeId}
          isOpen
          close={() => setEditando(false)}
        />
      )}
    </>
  );
}
