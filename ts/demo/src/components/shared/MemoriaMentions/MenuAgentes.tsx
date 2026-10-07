// ----------------------------------------------------------------------
// A lista que abre depois do "@": agentes do sistema e do usuário. Mesmo casco
// do MenuMemoria (portal, posição fixa, vira para cima quando não cabe embaixo,
// fica dentro da viewport na horizontal, rola por dentro).
// ----------------------------------------------------------------------

import { Fragment, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import { AgenteAvatar } from "@/components/shared/AgenteAvatar";
import type { AgenteMencionavel } from "@/app/contexts/agentes/context";
import type { CaretPos } from "./caret";

const LARGURA = 300;

const GRUPO: Record<AgenteMencionavel["tipo"], string> = {
  sistema: "Agentes do sistema",
  pessoal: "Meus agentes",
};

export function MenuAgentes({
  itens,
  ativo,
  query,
  pos,
  onEscolher,
  onAtivar,
}: {
  itens: AgenteMencionavel[];
  ativo: number;
  query: string;
  pos: CaretPos;
  onEscolher: (agente: AgenteMencionavel) => void;
  onAtivar: (i: number) => void;
}) {
  const listaRef = useRef<HTMLDivElement>(null);

  // Mantém o item selecionado visível quando se navega pelo teclado.
  useEffect(() => {
    const el = listaRef.current?.querySelector<HTMLElement>(
      `[data-indice="${ativo}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  // Altura real limitada (max-h-64 + cabeçalhos/rodapé): decide o lado.
  const alturaEstimada = Math.min(itens.length + 2, 8) * 40 + 32;
  const abaixo = pos.top + pos.alturaLinha + alturaEstimada < window.innerHeight;
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - LARGURA - 8));
  const estilo = abaixo
    ? { left, top: pos.top + pos.alturaLinha + 4 }
    : { left, bottom: window.innerHeight - pos.top + 4 };

  const termo = query.trim();

  return createPortal(
    <div
      style={{ position: "fixed", width: LARGURA, ...estilo }}
      className="dark:border-dark-500 dark:bg-dark-750 z-[999] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg shadow-gray-200/60 dark:shadow-none"
      onMouseDown={(e) => e.preventDefault()}
    >
      {itens.length === 0 ? (
        <p className="dark:text-dark-300 px-3 py-3 text-xs-plus text-gray-500">
          {termo
            ? `Nenhum agente com “${termo}”.`
            : "Nenhum agente disponível."}
        </p>
      ) : (
        <div ref={listaRef} className="max-h-64 overflow-y-auto py-1">
          {itens.map((agente, i) => (
            <Fragment key={agente.id}>
              {(i === 0 || itens[i - 1].tipo !== agente.tipo) && (
                <p className="dark:text-dark-300 px-3 pt-2 pb-1 text-tiny font-semibold tracking-wide text-gray-400 uppercase">
                  {GRUPO[agente.tipo]}
                </p>
              )}
              <button
                type="button"
                data-indice={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onEscolher(agente);
                }}
                onMouseEnter={() => onAtivar(i)}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                  i === ativo
                    ? "bg-primary-600/10 dark:bg-primary-400/10"
                    : "dark:hover:bg-dark-600 hover:bg-gray-100",
                )}
              >
                <AgenteAvatar titulo={agente.titulo} icone={agente.icone} />
                <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-xs-plus font-medium text-gray-700">
                  {agente.titulo}
                </span>
                <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
                  @{agente.mencao}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
      )}

      <p className="dark:border-dark-500 dark:text-dark-400 border-t border-gray-100 px-3 py-1.5 text-tiny text-gray-400">
        ↑↓ navegar · ↵ mencionar · esc sair
      </p>
    </div>,
    document.body,
  );
}
