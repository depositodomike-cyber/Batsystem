import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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

// A API devolve `date` em ISO 8601; a UI usa string de exibição (dd/mm/aaaa).
function fromApi(item: MemoryItem): MemoryItem {
  const date = item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "";
  return { ...item, date };
}

// Extrai uma mensagem legível do erro. O interceptor do axios rejeita com
// `error.response?.data` (NestJS: { message: string | string[] }) ou uma string.
function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (Array.isArray(m) && m.length) return String(m[0]);
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega a lista da API (escopo da empresa do usuário logado). Se falhar,
  // avisa o usuário em vez de mostrar a página silenciosamente vazia.
  useEffect(() => {
    let alive = true;
    fetchMemoriesApi()
      .then((items) => {
        if (alive) setMemories(items.map(fromApi));
      })
      .catch((err) => {
        if (!alive) return;
        setMemories([]);
        toast.error(
          apiErrorMessage(err, "Não foi possível carregar as memórias."),
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Cria a memória. Em caso de erro, mostra a mensagem e RE-LANÇA, para que a
  // tela mantenha o modal aberto (antes a falha era engolida e a memória
  // "salva" simplesmente não aparecia).
  const addMemory = useCallback(async (input: NewMemoryInput) => {
    try {
      const created = await createMemoryApi({
        category: input.category,
        title: input.title,
        content: input.content,
        source: input.source,
        confidence: input.confidence,
        corporate: input.corporate,
      });
      setMemories((prev) => [fromApi(created), ...prev]);
      toast.success("Memória salva.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível salvar a memória."));
      throw err;
    }
  }, []);

  const updateMemory = useCallback(
    async (id: string, patch: Partial<MemoryItem>) => {
      // Nada para atualizar (ex.: drawer fechando) — evita chamada à toa.
      if (Object.keys(patch).length === 0) return;
      try {
        const updated = await updateMemoryApi(id, {
          category: patch.category,
          title: patch.title,
          content: patch.content,
          source: patch.source,
          confidence: patch.confidence,
          active: patch.active,
        });
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? fromApi(updated) : m)),
        );
      } catch (err) {
        toast.error(apiErrorMessage(err, "Não foi possível atualizar a memória."));
        throw err;
      }
    },
    [],
  );

  const deleteMemory = useCallback(async (id: string) => {
    try {
      await deleteMemoryApi(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success("Memória removida.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível remover a memória."));
      throw err;
    }
  }, []);

  // Toggle otimista: reflete na hora e persiste em background. Reverte e avisa
  // se a persistência falhar.
  const toggleActive = useCallback((id: string) => {
    setMemories((prev) => {
      const current = prev.find((m) => m.id === id);
      // Corporativas são read-only: ignora.
      if (!current || current.corporate) return prev;
      const next = !current.active;
      void updateMemoryApi(id, { active: next }).catch((err) => {
        // Em caso de erro, reverte e avisa.
        setMemories((rb) =>
          rb.map((m) => (m.id === id ? { ...m, active: current.active } : m)),
        );
        toast.error(
          apiErrorMessage(err, "Não foi possível alterar o estado da memória."),
        );
      });
      return prev.map((m) => (m.id === id ? { ...m, active: next } : m));
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
