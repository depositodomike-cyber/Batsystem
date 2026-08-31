import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import {
  deleteConversaApi,
  fetchConversasApi,
  renameConversaApi,
  type ConversaListItem,
} from "@/services/api/conversas";

import { tokenArmazenado } from "@/utils/sessaoLocal";

import { ConversasContext, type ConversasContextValue } from "./context";

export function ConversasProvider({ children }: { children: ReactNode }) {
  const repositorioId = useRepositorioAtivo()?.id ?? null;
  const [items, setItems] = useState<ConversaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Deslogado não há o que buscar: este provider monta acima do router, então
    // ele existe também na tela de login, e sem esta guarda a página de login
    // disparava GET /conversas e colhia 401 em toda carga.
    if (!tokenArmazenado() || !repositorioId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setItems(
        await fetchConversasApi({ origem: "prompt", repositorioId }),
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [repositorioId]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    void refresh();
  }, [refresh]);

  const rename = useCallback(
    async (id: string, titulo: string) => {
      const updated = await renameConversaApi(id, titulo);
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c)),
      );
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteConversaApi(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo<ConversasContextValue>(
    () => ({ items, loading, refresh, rename, remove }),
    [items, loading, refresh, rename, remove],
  );

  return <ConversasContext value={value}>{children}</ConversasContext>;
}
