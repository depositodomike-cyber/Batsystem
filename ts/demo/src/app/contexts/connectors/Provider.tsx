import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { connectors } from "@/app/data/conectores";
import { useAuthContext } from "@/app/contexts/auth/context";
import {
  connectConectorApi,
  disconnectConectorApi,
  fetchConectoresApi,
  type CredenciaisResumo,
} from "@/services/api/conectores";
import { chaveConta, lerComMigracao } from "@/utils/escopoConta";
import { ConnectorsContext, type ConnectorsContextValue } from "./context";

// ----------------------------------------------------------------------

const STORAGE_BASE = "ceo-os:connectors";

// Conectores OAuth nunca entram na semente do modo demo: só há conexão se o
// servidor tiver as credenciais do provedor.
function defaultConnected(): Set<string> {
  return new Set(
    connectors.filter((c) => c.connectedByDefault && !c.oauth).map((c) => c.id),
  );
}

function loadConnected(): Set<string> {
  try {
    const raw = lerComMigracao(STORAGE_BASE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(String));
    }
  } catch {
    /* ignora */
  }
  // Sem registro salvo → semeia com os conectados por padrão (modo demo).
  return defaultConnected();
}

/**
 * Estado dos conectores. Autenticado, a fonte de verdade é o backend
 * (GET /conectores) — o mesmo estado gerenciado pelo servidor MCP, então
 * alterações feitas por um cliente MCP aparecem aqui ao recarregar.
 * O localStorage vira cache para render imediato e fallback offline/demo.
 */
export function ConnectorsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const [connectedIds, setConnectedIds] = useState<Set<string>>(loadConnected);
  // id → nome do workspace autorizado via OAuth (só vem do servidor).
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({});
  // id → quais campos de credencial estão preenchidos (nomes, nunca valores).
  // Não vai para o localStorage: é estado do servidor, e cachear "tem
  // credencial" localmente mostraria conectado o que o servidor não confirma.
  const [credenciais, setCredenciais] = useState<
    Record<string, CredenciaisResumo>
  >({});

  // Sincroniza com o servidor após autenticar; servidor ganha do cache.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchConectoresApi()
      .then((items) => {
        if (cancelled) return;
        setConnectedIds(
          new Set(items.filter((c) => c.connected).map((c) => c.id)),
        );
        setWorkspaces(
          Object.fromEntries(
            items
              .filter((c) => c.workspace)
              .map((c) => [c.id, c.workspace as string]),
          ),
        );
        setCredenciais(
          Object.fromEntries(
            items
              .filter((c) => c.credenciais)
              .map((c) => [c.id, c.credenciais as CredenciaisResumo]),
          ),
        );
      })
      .catch(() => {
        /* sem API no ar → mantém o cache local */
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Cache local a cada alteração (render imediato na próxima visita).
  useEffect(() => {
    try {
      localStorage.setItem(
        chaveConta(STORAGE_BASE),
        JSON.stringify([...connectedIds]),
      );
    } catch {
      /* ignora falhas de persistência (ex.: modo privado) */
    }
  }, [connectedIds]);

  const isConnected = useCallback(
    (id: string) => connectedIds.has(id),
    [connectedIds],
  );

  // Atualização otimista: muda a UI na hora e persiste no backend em
  // background; se a API falhar, reverte para o estado anterior.
  const apply = useCallback(
    (id: string, connect: boolean) => {
      setConnectedIds((prev) => {
        if (prev.has(id) === connect) return prev;
        const next = new Set(prev);
        if (connect) next.add(id);
        else next.delete(id);
        return next;
      });
      if (!connect) {
        // Desconectar também descarta credenciais no servidor (a linha de
        // empresa_conectores é apagada), então o resumo local vai com ela.
        setWorkspaces((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setCredenciais((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      if (!isAuthenticated) return;
      const call = connect ? connectConectorApi : disconnectConectorApi;
      call(id).catch(() => {
        setConnectedIds((prev) => {
          const next = new Set(prev);
          if (connect) next.delete(id);
          else next.add(id);
          return next;
        });
      });
    },
    [isAuthenticated],
  );

  const connect = useCallback((id: string) => apply(id, true), [apply]);
  const disconnect = useCallback((id: string) => apply(id, false), [apply]);

  const toggleConnection = useCallback(
    (id: string) => apply(id, !connectedIds.has(id)),
    [apply, connectedIds],
  );

  const getWorkspace = useCallback(
    (id: string) => workspaces[id] ?? null,
    [workspaces],
  );

  const getCredenciais = useCallback(
    (id: string) => credenciais[id] ?? null,
    [credenciais],
  );

  const aplicarCredenciais = useCallback(
    (id: string, resumo: CredenciaisResumo | null) => {
      setCredenciais((prev) => {
        const next = { ...prev };
        if (resumo) next[id] = resumo;
        else delete next[id];
        return next;
      });
      // Salvar credenciais é o que conecta estes conectores: o servidor já fez
      // o upsert, então aqui é só refletir na UI.
      if (resumo) {
        setConnectedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      }
    },
    [],
  );

  const value = useMemo<ConnectorsContextValue>(
    () => ({
      connectedIds,
      isConnected,
      connect,
      disconnect,
      toggleConnection,
      getWorkspace,
      getCredenciais,
      aplicarCredenciais,
    }),
    [
      connectedIds,
      isConnected,
      connect,
      disconnect,
      toggleConnection,
      getWorkspace,
      getCredenciais,
      aplicarCredenciais,
    ],
  );

  return (
    <ConnectorsContext value={value}>{children}</ConnectorsContext>
  );
}
