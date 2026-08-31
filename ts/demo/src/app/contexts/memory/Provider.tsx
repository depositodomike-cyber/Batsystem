import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ERRO_SEM_RESPOSTA } from "@/utils/axios";

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

/**
 * Servidor inalcançável: não houve resposta HTTP nenhuma — fora do ar, DNS ou
 * preflight de CORS barrado.
 *
 * 401 NÃO entra aqui, e é a correção principal deste arquivo: o servidor
 * respondeu, só recusou a credencial. Enquanto `unauthorized|401|sessão`
 * estavam nesta regex, o 401 da primeira requisição do boot (disparada antes de
 * o Authorization existir) ligava o modo local, avisava "Servidor indisponível"
 * com a API no ar e prendia todo o CRUD no localStorage pelo resto da sessão.
 */
function servidorInalcancavel(err: unknown): boolean {
  if (err === ERRO_SEM_RESPOSTA) return true;
  return /network error|econnrefused|failed to fetch/i.test(
    apiErrorMessage(err, ""),
  );
}

/** 401/403 — credencial recusada, não indisponibilidade. */
function ehNaoAutorizado(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const o = err as { statusCode?: number; status?: number };
  const status = o.statusCode ?? o.status;
  return status === 401 || status === 403;
}

/**
 * Gravar só no localStorage, sem tentar o servidor.
 *
 * Reservado ao token de protótipo: essa sessão nunca existiu no servidor, então
 * a chamada seria 401 garantido. É uma FUNÇÃO reavaliada a cada operação, e não
 * mais um ref ligado no primeiro erro: entrar de novo volta a gravar no servidor
 * sem recarregar a página, e uma falha passageira não condena a sessão inteira.
 */
function gravarSoLocal(): boolean {
  return tokenEhPrototipo();
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
  };
}

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      if (gravarSoLocal()) {
        if (alive) {
          setMemories(carregarMemoriasLocal());
          setLoading(false);
        }
        return;
      }

      try {
        const items = await fetchMemoriesApi();
        if (!alive) return;
        const mapped = items.map(fromApi);
        setMemories(mapped);
        salvarMemoriasLocal(mapped);
      } catch (err) {
        if (!alive) return;
        // Em qualquer falha a cópia local entra para a tela não ficar vazia,
        // mas só a indisponibilidade real anuncia "modo local": um 401 é sessão
        // recusada, e dizer "servidor indisponível" aí mandava o usuário
        // procurar problema no lugar errado.
        setMemories(carregarMemoriasLocal());
        if (servidorInalcancavel(err)) {
          toast.message("Regras em modo local", {
            description:
              "Servidor indisponível — alterações ficam neste navegador.",
          });
        } else if (ehNaoAutorizado(err)) {
          toast.error("Sessão recusada pelo servidor", {
            description: "Saia e entre novamente para ver o Repositório.",
          });
        } else {
          toast.error(
            apiErrorMessage(err, "Não foi possível carregar as memórias."),
          );
        }
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
      if (gravarSoLocal()) {
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
          corporate: input.corporate,
        });
        const mapped = fromApi(created);
        setMemories((prev) => {
          const next = [mapped, ...prev];
          salvarMemoriasLocal(next);
          return next;
        });
        toast.success("Repositório salvo.");
      } catch (err) {
        if (servidorInalcancavel(err)) {
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

      if (gravarSoLocal()) {
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
          active: patch.active,
        });
        const mapped = fromApi(updated);
        setMemories((prev) => {
          const next = prev.map((m) => (m.id === id ? mapped : m));
          salvarMemoriasLocal(next);
          return next;
        });
      } catch (err) {
        if (servidorInalcancavel(err)) {
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
      if (gravarSoLocal()) {
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
        toast.success("Repositório removido.");
      } catch (err) {
        if (servidorInalcancavel(err)) {
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

      if (gravarSoLocal()) {
        salvarMemoriasLocal(next);
        return next;
      }

      void updateMemoryApi(id, { active: nextActive }).catch((err) => {
        if (servidorInalcancavel(err)) {
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
