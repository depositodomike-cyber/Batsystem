/**
 * Seção Repositório: seletor do contexto ativo + Home (Grafo/Lista
 * ficam na página, ao lado de Sincronizar).
 */

import clsx from "clsx";
import { useLocation } from "react-router";

import type { NavigationTree } from "@/@types/navigation";
import { useThemeContext } from "@/app/contexts/theme/context";

import { ContextoSelect } from "./ContextoSelect";
import { MenuItem } from "./Group/MenuItem";
import {
  caminhoRepositorio,
  ehPaginaRepositorio,
} from "@/app/pages/ceo/RepositorioViewSelect";

export function ContextSection({ product }: { product: string }) {
  const { cardSkin } = useThemeContext();
  const { pathname } = useLocation();

  const homeItem: NavigationTree = {
    id: `${product}.memoria-home`,
    type: "item",
    path: caminhoRepositorio(product),
    title: "Home",
    transKey: "nav.ceo.home",
    icon: "ceo.home",
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
        <MenuItem data={homeItem} active={ehPaginaRepositorio(pathname)} />
      </div>
    </section>
  );
}
