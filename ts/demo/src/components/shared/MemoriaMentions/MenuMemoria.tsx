// ----------------------------------------------------------------------
// A lista que abre depois do "[[". Vai num portal com posição fixa: a maioria
// dos campos vive dentro de modais com overflow, onde um dropdown "absolute"
// seria cortado pela borda do modal.
// ----------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import type { CaretPos } from "./caret";
import type { AlvoMemoria } from "./alvos";

const LARGURA = 320;

export function MenuMemoria({
  itens,
  ativo,
  query,
  pos,
  onEscolher,
  onAtivar,
}: {
  itens: AlvoMemoria[];
  ativo: number;
  query: string;
  pos: CaretPos;
  onEscolher: (titulo: string) => void;
  onAtivar: (i: number) => void;
}) {
  const listaRef = useRef<HTMLUListElement>(null);

  // Mantém o item selecionado visível quando se navega pelo teclado.
  useEffect(() => {
    const el = listaRef.current?.children[ativo] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const alturaEstimada = Math.min(itens.length + 1, 7) * 44 + 32;
  const abaixo = pos.top + pos.alturaLinha + alturaEstimada < window.innerHeight;
  const left = Math.max(
    8,
    Math.min(pos.left, window.innerWidth - LARGURA - 8),
  );
  const estilo = abaixo
    ? { left, top: pos.top + pos.alturaLinha + 4 }
    : { left, bottom: window.innerHeight - pos.top + 4 };

  const termo = query.trim();

  return createPortal(
    <div
      style={{ position: "fixed", width: LARGURA, ...estilo }}
      className="dark:border-dark-500 dark:bg-dark-750 z-[999] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg shadow-gray-200/60 dark:shadow-none"
      // O campo não pode perder o foco quando se clica na lista.
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className="dark:border-dark-500 dark:text-dark-300 border-b border-gray-100 px-3 py-1.5 text-tiny text-gray-400">
        Conectar ao Repositório {termo ? `· “${termo}”` : ""}
      </p>

      {itens.length === 0 ? (
        <p className="dark:text-dark-300 px-3 py-3 text-xs-plus text-gray-500">
          {termo
            ? "Nenhuma nota com esse nome. ↵ cria o link mesmo assim."
            : "Nenhuma nota no Repositório ainda."}
        </p>
      ) : (
        <ul ref={listaRef} className="max-h-64 overflow-y-auto py-1">
          {itens.map((item, i) => (
            <li key={`${item.tipo}:${item.titulo}`}>
              <button
                type="button"
                // No mousedown, como no compositor de comentários: o clique
                // precisa valer ANTES do blur do campo, que fecharia a lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onEscolher(item.titulo);
                }}
                onMouseEnter={() => onAtivar(i)}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                  i === ativo
                    ? "bg-primary-600/10 dark:bg-primary-400/10"
                    : "dark:hover:bg-dark-600 hover:bg-gray-100",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="dark:text-dark-100 block truncate text-xs-plus font-medium text-gray-700">
                    {item.titulo}
                  </span>
                  <span className="dark:text-dark-400 block truncate text-tiny text-gray-400">
                    {item.detalhe}
                  </span>
                </span>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-tiny",
                    item.tipo === "nota"
                      ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                      : "dark:bg-dark-600 dark:text-dark-200 bg-gray-100 text-gray-500",
                  )}
                >
                  {item.tipo === "nota" ? "nota" : "regra"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="dark:border-dark-500 dark:text-dark-400 border-t border-gray-100 px-3 py-1.5 text-tiny text-gray-400">
        ↑↓ navegar · ↵ inserir · esc sair
      </p>
    </div>,
    document.body,
  );
}
