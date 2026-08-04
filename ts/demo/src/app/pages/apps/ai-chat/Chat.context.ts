// Local Imports
import { createSafeContext } from "@/utils/createSafeContext";
import { Chat } from "./data";

export interface NewMessageData {
  content: string;
}

export interface ChatContextValue {
  chats: Chat[];
  currentChat: Chat | undefined;
  newMessage: (chatId: string | null, data: NewMessageData) => void;
  setActiveChatId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const [ChatContextProvider, useChatContext] = createSafeContext<ChatContextValue>(
  "useChatContext must be used within ChatProvider",
);
