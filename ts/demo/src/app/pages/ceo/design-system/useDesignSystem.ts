// Hooks React sobre o store de marcas. Qualquer criação/edição/troca de marca
// re-renderiza todas as barras abertas (várias janelas de IA ao mesmo tempo).

import { useSyncExternalStore } from "react";

import * as store from "./store";
import type { BrandOption, DesignSystem } from "./types";

/** Lista de marcas + marca ativa, já reativas. */
export function useDesignSystems(): {
  brands: BrandOption[];
  activeId: string;
  setActive: (id: string) => void;
  criar: () => string;
} {
  useSyncExternalStore(store.subscribe, store.getVersao, store.getVersao);
  return {
    brands: store.listBrands(),
    activeId: store.getActiveId(),
    setActive: store.setActive,
    criar: store.criar,
  };
}

/** Design system da marca ativa (reativo). */
export function useActiveDesignSystem(): DesignSystem {
  useSyncExternalStore(store.subscribe, store.getVersao, store.getVersao);
  return store.getActive();
}
