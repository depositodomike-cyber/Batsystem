import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { MemoryItem } from "@/app/data/memoria";
import {
  fetchMemoriesApi,
  createMemoryApi,
  updateMemoryApi,
  deleteMemoryApi,
} from "@/services/api/memorias";
import {
  MemoryContext,
  type MemoryContextValue,
  type NewMemoryInput,
} from "./context";
import {
  carregarMemoriasLocal,
  salvarMemoriasLocal,
  tokenEhPrototipo,
} from "./persistencia";

// A API devolve `date` em ISO 8601; a UI usa string de exibição (dd/mm/aaaa).
function fromApi(item: MemoryItem): MemoryItem {
  const date = item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "";
  return { ...item, date };
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (Array.isArray(m) && m.length) return String(m[0]);
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

function pareceApiIndisponivel(err: unknown): boolean {
  if (err === "Something went wrong") return true;
  const msg = apiErrorMessage(err, "");
  return /network error|econnrefused|failed to fetch|unauthorized|401|sessão/i.test(
    msg,
  );
}

function idLocal(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function memoriaLocalDe(input: NewMemoryInput): MemoryItem {
  return {
    id: idLocal(),
    category: input.category?.trim() || "Regras",
    title: input.title.trim(),
    content: input.content.trim(),
    source: input.source?.trim() || "Manual",
    date: new Date().toLocaleDateString("pt-BR"),
    active: true,
    corporate: !!input.corporate,
    confidence: input.confidence ?? "alta",
  };
}

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Quando true, CRUD grava só no localStorage. */
  const modoLocalRef = useRef(tokenEhPrototipo());

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      if (tokenEhPrototipo()) {
        modoLocalRef.current = true;
        if (alive) {
          setMemories(carregarMemoriasLocal());
          setLoading(false);
        }
        return;
      }

      try {
        const items = await fetchMemoriesApi();
        if (!alive) return;
        modoLocalRef.current = false;
        const mapped = items.map(fromApi);
        setMemories(mapped);
        salvarMemoriasLocal(mapped);
      } catch (err) {
        if (!alive) return;
        modoLocalRef.current = true;
        const locais = carregarMemoriasLocal();
        setMemories(locais);
        toast.message("Regras em modo local", {
          description: pareceApiIndisponivel(err)
            ? "Servidor indisponível — alterações ficam neste navegador."
            : apiErrorMessage(err, "Não foi possível carregar as memórias."),
        });
      } finally {
        if (alive) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  const persistirLocal = useCallback((items: MemoryItem[]) => {
    setMemories(items);
    salvarMemoriasLocal(items);
  }, []);

  const addMemory = useCallback(
    async (input: NewMemoryInput) => {
      if (modoLocalRef.current) {
        const criada = memoriaLocalDe(input);
        persistirLocal([criada, ...carregarMemoriasLocal()]);
        toast.success("Regra salva (local).");
        return;
      }

      try {
        const created = await createMemoryApi({
          category: input.category,
          title: input.title,
          content: input.content,
          source: input.source,
          confidence: input.confidence,
          corporate: input.corporate,
        });
        const mapped = fromApi(created);
        setMemories((prev) => {
          const next = [mapped, ...prev];
          salvarMemoriasLocal(next);
          return next;
        });
        toast.success("Contexto salvo.");
      } catch (err) {
        if (pareceApiIndisponivel(err)) {
          modoLocalRef.current = true;
          const criada = memoriaLocalDe(input);
          persistirLocal([criada, ...carregarMemoriasLocal()]);
          toast.message("Regra salva localmente", {
            description: "O servidor não respondeu; a regra ficou neste navegador.",
          });
          return;
        }
        toast.error(apiErrorMessage(err, "Não foi possível salvar a memória."));
        throw err;
      }
    },
    [persistirLocal],
  );

  const updateMemory = useCallback(
    async (id: string, patch: Partial<MemoryItem>) => {
      if (Object.keys(patch).length === 0) return;

      if (modoLocalRef.current) {
        const next = carregarMemoriasLocal().map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        );
        persistirLocal(next);
        return;
      }

      try {
        const updated = await updateMemoryApi(id, {
          category: patch.category,
          title: patch.title,
          content: patch.content,
          source: patch.source,
          confidence: patch.confidence,
          active: patch.active,
        });
        const mapped = fromApi(updated);
        setMemories((prev) => {
          const next = prev.map((m) => (m.id === id ? mapped : m));
          salvarMemoriasLocal(next);
          return next;
        });
      } catch (err) {
        if (pareceApiIndisponivel(err)) {
          modoLocalRef.current = true;
          const next = carregarMemoriasLocal().map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          );
          persistirLocal(next);
          toast.message("Alteração salva localmente");
          return;
        }
        toast.error(
          apiErrorMessage(err, "Não foi possível atualizar a memória."),
        );
        throw err;
      }
    },
    [persistirLocal],
  );

  const deleteMemory = useCallback(
    async (id: string) => {
      if (modoLocalRef.current) {
        persistirLocal(carregarMemoriasLocal().filter((m) => m.id !== id));
        toast.success("Regra removida (local).");
        return;
      }

      try {
        await deleteMemoryApi(id);
        setMemories((prev) => {
          const next = prev.filter((m) => m.id !== id);
          salvarMemoriasLocal(next);
          return next;
        });
        toast.success("Contexto removido.");
      } catch (err) {
        if (pareceApiIndisponivel(err)) {
          modoLocalRef.current = true;
          persistirLocal(carregarMemoriasLocal().filter((m) => m.id !== id));
          toast.message("Regra removida localmente");
          return;
        }
        toast.error(apiErrorMessage(err, "Não foi possível remover a memória."));
        throw err;
      }
    },
    [persistirLocal],
  );

  const toggleActive = useCallback((id: string) => {
    setMemories((prev) => {
      const current = prev.find((m) => m.id === id);
      if (!current || current.corporate) return prev;
      const nextActive = !current.active;
      const next = prev.map((m) =>
        m.id === id ? { ...m, active: nextActive } : m,
      );

      if (modoLocalRef.current) {
        salvarMemoriasLocal(next);
        return next;
      }

      void updateMemoryApi(id, { active: nextActive }).catch((err) => {
        if (pareceApiIndisponivel(err)) {
          modoLocalRef.current = true;
          salvarMemoriasLocal(next);
          return;
        }
        setMemories((rb) =>
          rb.map((m) => (m.id === id ? { ...m, active: current.active } : m)),
        );
        toast.error(
          apiErrorMessage(err, "Não foi possível alterar o estado da memória."),
        );
      });
      return next;
    });
  }, []);

  const value = useMemo<MemoryContextValue>(
    () => ({
      memories,
      loading,
      addMemory,
      updateMemory,
      deleteMemory,
      toggleActive,
    }),
    [memories, loading, addMemory, updateMemory, deleteMemory, toggleActive],
  );

  return <MemoryContext value={value}>{children}</MemoryContext>;
}
