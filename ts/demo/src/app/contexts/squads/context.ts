import { createSafeContext } from "@/utils/createSafeContext";
import { type Squad } from "@/app/navigation/ceoOs";

// ----------------------------------------------------------------------

export interface SquadsContextValue {
  /** Catálogo completo de squads, carregado da API (GET /squads). */
  catalog: Squad[];
  /** Catálogo ainda carregando (primeira busca). */
  catalogLoading: boolean;
  /** A busca do catálogo falhou. */
  catalogError: boolean;
  /** Busca um squad do catálogo por id. */
  getSquadById: (id: string) => Squad | undefined;
  /** Busca um squad do catálogo por slug. */
  getSquadBySlug: (slug: string) => Squad | undefined;
  /** Squads fixados no menu esquerdo, na ordem em que foram adicionados. */
  pinnedSquads: Squad[];
  /** Indica se um squad (por id) está fixado. */
  isPinned: (id: string) => boolean;
  /** Fixa um squad no menu. */
  pinSquad: (id: string) => void;
  /** Remove um squad fixado do menu. */
  unpinSquad: (id: string) => void;
  /** Alterna o estado de fixado de um squad. */
  toggleSquad: (id: string) => void;
}

export const [SquadsContext, useSquadsContext] =
  createSafeContext<SquadsContextValue>(
    "useSquadsContext must be used within SquadsProvider",
  );
