import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------

export interface Chat {
  id: string;
  /** Produto ao qual o chat pertence (ex.: "business-partner"). */
  product: string;
  title: string;
  /** Squad que originou a conversa (ex.: "Conselho"). */
  squadName?: string;
  /** Id do squad no catálogo (ex.: "bp.conselho"), permite linkar de volta. */
  squadId?: string;
  /** Id do agente específico, quando a conversa foi iniciada com um agente. */
  agentId?: string;
  /** Nome de referência do agente (ex.: "Peter Drucker"), para exibição. */
  agentReference?: string;
  /** Primeira mensagem do usuário (a pergunta-modelo que disparou o chat). */
  firstMessage?: string;
  /** Agrupamento (grupo) ao qual o chat foi movido, quando houver. */
  projectId?: string;
  /** Id da conversa persistida no backend (/conversas) — fonte das mensagens. */
  conversaId?: string;
}

export type NewChat = Omit<Chat, "id">;

export interface ChatsContextValue {
  /** Todos os chats (de todos os produtos). */
  chats: Chat[];
  /** Chats de um produto específico. */
  chatsByProduct: (product: string) => Chat[];
  /** Chats movidos para um grupo (agrupamento) específico. */
  chatsByProject: (projectId: string) => Chat[];
  addChat: (data: NewChat) => Chat;
  removeChat: (id: string) => void;
  /** Renomeia o título de um chat do histórico. */
  renameChat: (id: string, title: string) => void;
  /** Move o chat para um agrupamento (grupo). Passe null para remover do grupo. */
  moveChatToProject: (id: string, projectId: string | null) => void;
  /** Vincula o chat à conversa persistida no backend (id de /conversas). */
  linkConversa: (id: string, conversaId: string) => void;
  getChat: (id: string) => Chat | undefined;
}

export const [ChatsContext, useChatsContext] =
  createSafeContext<ChatsContextValue>(
    "useChatsContext must be used within ChatsProvider",
  );
