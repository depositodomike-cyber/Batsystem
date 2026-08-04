import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { type Squad } from "@/app/navigation/ceoOs";
import { useAuthContext } from "@/app/contexts/auth/context";
import { fetchSquadCatalogApi } from "@/services/api/squads";
import { SquadsContext, type SquadsContextValue } from "./context";

// ----------------------------------------------------------------------

const STORAGE_KEY = "ceo-os:pinned-squads";

function loadPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ids inválidos são descartados na resolução (pinnedSquads), assim que o
    // catálogo carregar — aqui só garantimos que são strings.
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function SquadsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinnedIds);

  // Catálogo carregado da API (fonte de verdade de "todos os squads").
  const [catalog, setCatalog] = useState<Squad[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);

  // Busca o catálogo após autenticar (o endpoint exige JWT).
  useEffect(() => {
    if (!isAuthenticated) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(false);
    fetchSquadCatalogApi()
      .then((items) => {
        if (cancelled) return;
        setCatalog(
          items.map((s) => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            icon: s.icon ?? "",
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCatalogError(true);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds));
    } catch {
      /* ignora falhas de persistência (ex.: modo privado) */
    }
  }, [pinnedIds]);

  const getSquadById = useCallback(
    (id: string) => catalog.find((s) => s.id === id),
    [catalog],
  );

  const getSquadBySlug = useCallback(
    (slug: string) => catalog.find((s) => s.slug === slug),
    [catalog],
  );

  const isPinned = useCallback(
    (id: string) => pinnedIds.includes(id),
    [pinnedIds],
  );

  const pinSquad = useCallback((id: string) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unpinSquad = useCallback((id: string) => {
    setPinnedIds((prev) => prev.filter((p) => p !== id));
  }, []);

  const toggleSquad = useCallback((id: string) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  // Resolve os squads fixados preservando a ordem de fixação do usuário.
  // Ids que não existem (mais) no catálogo são naturalmente descartados.
  const pinnedSquads = useMemo(
    () =>
      pinnedIds
        .map((id) => catalog.find((s) => s.id === id))
        .filter((s): s is Squad => Boolean(s)),
    [pinnedIds, catalog],
  );

  const value = useMemo<SquadsContextValue>(
    () => ({
      catalog,
      catalogLoading,
      catalogError,
      getSquadById,
      getSquadBySlug,
      pinnedSquads,
      isPinned,
      pinSquad,
      unpinSquad,
      toggleSquad,
    }),
    [
      catalog,
      catalogLoading,
      catalogError,
      getSquadById,
      getSquadBySlug,
      pinnedSquads,
      isPinned,
      pinSquad,
      unpinSquad,
      toggleSquad,
    ],
  );

  return <SquadsContext value={value}>{children}</SquadsContext>;
}
