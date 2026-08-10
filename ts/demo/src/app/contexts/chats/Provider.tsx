import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { chaveConta, lerComMigracao } from "@/utils/escopoConta";
import {
  ChatsContext,
  type ChatsContextValue,
  type Chat,
  type NewChat,
} from "./context";

// ----------------------------------------------------------------------

const STORAGE_BASE = "ceo-os:chats";

function createId(): string {
  return `chat_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function loadChats(): Chat[] {
  try {
    const raw = lerComMigracao(STORAGE_BASE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(
      (c): Chat => ({
        id: String(c?.id ?? createId()),
        product: String(c?.product ?? ""),
        title: String(c?.title ?? ""),
        squadName: c?.squadName ? String(c.squadName) : undefined,
        squadId: c?.squadId ? String(c.squadId) : undefined,
        agentId: c?.agentId ? String(c.agentId) : undefined,
        agentReference: c?.agentReference
          ? String(c.agentReference)
          : undefined,
        firstMessage: c?.firstMessage ? String(c.firstMessage) : undefined,
        projectId: c?.projectId ? String(c.projectId) : undefined,
        conversaId: c?.conversaId ? String(c.conversaId) : undefined,
      }),
    );
  } catch {
    return [];
  }
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>(loadChats);

  useEffect(() => {
    try {
      localStorage.setItem(chaveConta(STORAGE_BASE), JSON.stringify(chats));
    } catch {
      /* ignora falhas de persistência (ex.: modo privado) */
    }
  }, [chats]);

  const addChat = useCallback((data: NewChat) => {
    const chat: Chat = { id: createId(), ...data };
    // Mais recentes primeiro.
    setChats((prev) => [chat, ...prev]);
    return chat;
  }, []);

  const removeChat = useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameChat = useCallback((id: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const moveChatToProject = useCallback(
    (id: string, projectId: string | null) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, projectId: projectId ?? undefined } : c,
        ),
      );
    },
    [],
  );

  const linkConversa = useCallback((id: string, conversaId: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, conversaId } : c)),
    );
  }, []);

  const getChat = useCallback(
    (id: string) => chats.find((c) => c.id === id),
    [chats],
  );

  const chatsByProduct = useCallback(
    (product: string) => chats.filter((c) => c.product === product),
    [chats],
  );

  const chatsByProject = useCallback(
    (projectId: string) => chats.filter((c) => c.projectId === projectId),
    [chats],
  );

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatsByProduct,
      chatsByProject,
      addChat,
      removeChat,
      renameChat,
      moveChatToProject,
      linkConversa,
      getChat,
    }),
    [
      chats,
      chatsByProduct,
      chatsByProject,
      addChat,
      removeChat,
      renameChat,
      moveChatToProject,
      linkConversa,
      getChat,
    ],
  );

  return <ChatsContext value={value}>{children}</ChatsContext>;
}
