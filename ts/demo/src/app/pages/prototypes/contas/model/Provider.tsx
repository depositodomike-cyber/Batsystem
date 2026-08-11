/**
 * Provider do protótipo. Hidrata de `sessionStorage` no initializer do
 * `useReducer` e escreve a cada mudança de estado.
 */

import { useEffect, useMemo, useReducer, type ReactNode } from "react";

import { definirRepositorioPastaAtivo } from "@/app/pages/ceo/memoria-inventario";

import { PrototipoContasContext } from "./context";
import { carregar, salvar } from "./persistencia";
import { reducer } from "./reducer";
import { repositorioAtivo } from "./selectors";

export function PrototipoContasProvider({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reducer, undefined, carregar);

  useEffect(() => {
    salvar(estado);
  }, [estado]);

  // Isola a pasta do Repositório (IndexedDB) pelo repositório ativo.
  useEffect(() => {
    definirRepositorioPastaAtivo(repositorioAtivo(estado)?.id ?? null);
  }, [estado]);

  const valor = useMemo(() => ({ estado, despachar }), [estado]);

  return (
    <PrototipoContasContext value={valor}>{children}</PrototipoContasContext>
  );
}
