/**
 * Seção Repositório: seletor do contexto ativo + select de visualização
 * (Lista ou Grafo). Sempre expandida — não é collapse.
 */

import clsx from "clsx";

import type { NavigationTree } from "@/@types/navigation";
import { useThemeContext } from "@/app/contexts/theme/context";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

import { ContextoSelect } from "./ContextoSelect";
import { MenuItem } from "./Group/MenuItem";
import { VisualizacaoSelect } from "./VisualizacaoSelect";

export function ContextSection({ product }: { product: string }) {
  const { cardSkin } = useThemeContext();
  const grafoDesabilitado = isFeatureTemporarilyDisabled("memoryGraph");

  const listaItem: NavigationTree = {
    id: `${product}.memoria-lista`,
    type: "item",
    path: `/${product}/memoria-lista`,
    title: "Lista",
    icon: "ceo.contexto-lista",
  };

  return (
    <section className="pt-3">
      <div
        className={clsx(
          "sticky top-0 z-10 bg-white px-6",
          cardSkin === "bordered" ? "dark:bg-dark-900" : "dark:bg-dark-750",
        )}
      >
        <p className="dark:text-dark-300 mb-1.5 pt-2 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
          Repositório
        </p>
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-linear-to-b from-white to-transparent",
            cardSkin === "bordered"
              ? "dark:from-dark-900"
              : "dark:from-dark-750",
          )}
        />
      </div>

      <div className="flex flex-col space-y-0.5">
        <ContextoSelect />
        {grafoDesabilitado ? (
          <MenuItem data={listaItem} />
        ) : (
          <VisualizacaoSelect product={product} />
        )}
      </div>
    </section>
  );
}
