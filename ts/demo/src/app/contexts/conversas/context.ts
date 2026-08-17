import { createSafeContext } from "@/utils/createSafeContext";
import type { ConversaListItem } from "@/services/api/conversas";

export interface ConversasContextValue {
  items: ConversaListItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  rename: (id: string, titulo: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const [ConversasContext, useConversasContext] =
  createSafeContext<ConversasContextValue>(
    "useConversasContext must be used within ConversasProvider",
  );
