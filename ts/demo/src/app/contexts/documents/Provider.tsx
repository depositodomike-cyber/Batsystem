import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { idbGet, idbSet } from "@/utils/idbKv";
import {
  DocumentsContext,
  type DocumentAttachment,
  type DocumentsContextValue,
  type NewDocument,
  type SquadDocument,
} from "./context";

// ----------------------------------------------------------------------

const STORAGE_KEY = "ceo-os:documents";

function createId(): string {
  return `doc_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function normalizeAttachments(raw: unknown): DocumentAttachment[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const list = raw
    .map((a): DocumentAttachment | null => {
      const dataUrl = typeof a?.dataUrl === "string" ? a.dataUrl : "";
      if (!dataUrl) return null;
      return {
        name: String(a?.name ?? "arquivo"),
        mime: String(a?.mime ?? "application/octet-stream"),
        dataUrl,
      };
    })
    .filter((a): a is DocumentAttachment => a !== null);
  return list.length ? list : undefined;
}

function normalize(raw: unknown[]): SquadDocument[] {
  return raw.map((r): SquadDocument => {
    const d = r as Record<string, unknown>;
    return {
      id: String(d?.id ?? createId()),
      product: String(d?.product ?? ""),
      squadId: String(d?.squadId ?? ""),
      squadName: String(d?.squadName ?? ""),
      agentReference: d?.agentReference ? String(d.agentReference) : undefined,
      chatId: d?.chatId ? String(d.chatId) : undefined,
      projectId: d?.projectId ? String(d.projectId) : undefined,
      title: String(d?.title ?? ""),
      content: String(d?.content ?? ""),
      source: d?.source === "ai-studio" ? "ai-studio" : "chat",
      functionId: d?.functionId ? String(d.functionId) : undefined,
      attachments: normalizeAttachments(d?.attachments),
      createdAt: String(d?.createdAt ?? new Date(0).toISOString()),
    };
  });
}

/** Biblioteca antiga (localStorage) — lida uma única vez para migrar. */
function loadLegacy(): SquadDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<SquadDocument[]>([]);
  // Só persistimos depois da leitura inicial: gravar o array vazio do primeiro
  // render por cima do que está no IndexedDB apagaria a biblioteca.
  const [hydrated, setHydrated] = useState(false);
  const migratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: SquadDocument[] = [];
      try {
        const fromIdb = await idbGet<unknown[]>(STORAGE_KEY);
        if (Array.isArray(fromIdb)) stored = normalize(fromIdb);
        else {
          // Primeira execução após a migração: traz o que havia no localStorage.
          stored = loadLegacy();
          migratedRef.current = stored.length > 0;
        }
      } catch {
        stored = loadLegacy();
      }
      if (!cancelled) {
        setDocuments(stored);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    idbSet(STORAGE_KEY, documents)
      .then(() => {
        // Migrado com sucesso: libera a cota que a cópia antiga ocupava.
        if (migratedRef.current) {
          migratedRef.current = false;
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignora */
          }
        }
      })
      .catch(() => {
        /* ignora falhas de persistência (ex.: modo privado) */
      });
  }, [documents, hydrated]);

  const addDocument = useCallback((data: NewDocument) => {
    const doc: SquadDocument = {
      id: createId(),
      createdAt: new Date().toISOString(),
      ...data,
    };
    setDocuments((prev) => [doc, ...prev]);
    return doc;
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const getDocument = useCallback(
    (id: string) => documents.find((d) => d.id === id),
    [documents],
  );

  const documentsBySquad = useCallback(
    (squadId: string) => documents.filter((d) => d.squadId === squadId),
    [documents],
  );

  const documentsByProject = useCallback(
    (projectId: string) => documents.filter((d) => d.projectId === projectId),
    [documents],
  );

  const documentsByProduct = useCallback(
    (product: string) => documents.filter((d) => d.product === product),
    [documents],
  );

  const value = useMemo<DocumentsContextValue>(
    () => ({
      documents,
      documentsBySquad,
      documentsByProject,
      documentsByProduct,
      addDocument,
      removeDocument,
      getDocument,
    }),
    [
      documents,
      documentsBySquad,
      documentsByProject,
      documentsByProduct,
      addDocument,
      removeDocument,
      getDocument,
    ],
  );

  return <DocumentsContext value={value}>{children}</DocumentsContext>;
}
