import { createSafeContext } from "@/utils/createSafeContext";
import type { MemoryItem } from "@/app/data/memoria";

/**
 * Campos editáveis ao criar uma nova regra. `category` é opcional: a tela de
 * Regras não pede tema, e a API grava o tema padrão quando ele não vem.
 */
export type NewMemoryInput = Pick<MemoryItem, "title" | "content"> &
  Partial<Pick<MemoryItem, "category" | "source" | "confidence">> & {
    /** Fixar como definição corporativa (só admin). */
    corporate?: boolean;
  };

export interface MemoryContextValue {
  memories: MemoryItem[];
  /** Carregando a lista inicial da API. */
  loading: boolean;
  addMemory: (input: NewMemoryInput) => Promise<void>;
  updateMemory: (id: string, patch: Partial<MemoryItem>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  /** Liga/desliga o uso da memória pela IA. */
  toggleActive: (id: string) => void;
}

export const [MemoryContext, useMemoryContext] =
  createSafeContext<MemoryContextValue>(
    "useMemoryContext must be used within MemoryProvider",
  );
