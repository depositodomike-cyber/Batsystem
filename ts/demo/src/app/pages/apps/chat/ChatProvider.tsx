// Import Dependencies
import { useState, ReactNode, Dispatch, SetStateAction } from "react";

// Local Imports
import { ChatContextProvider } from "./Chat.context";
import { Chat, fakeChats } from "./data"; // Assuming fakeChats matches Chat[]
import { randomId } from "@/utils/randomId";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";

// ----------------------------------------------------------------------

export interface ChatContextValue {
  chats: Chat[];
  currentChat: Chat | undefined;
  newMessage: (chatId: string, data: { content: string }) => void;
  setActiveChatId: Dispatch<SetStateAction<string | null>>;
  showProfile: boolean;
  setShowProfile: Dispatch<SetStateAction<boolean>>;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>(fakeChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const { lgAndUp } = useBreakpointsContext();
  const [showProfile, setShowProfile] = useState<boolean>(lgAndUp);

  const currentChat = chats.find((chat) => chat.id === activeChatId);

  const newMessage = (chatId: string, data: { content: string }): void => {
    const now = new Date();
    const chatIndex = chats.findIndex((chat) => chat.id === chatId);

    if (chatIndex === -1) {
      console.error(`Chat with id ${chatId} not found.`);
      return;
    }

    const chat = { ...chats[chatIndex] }; 

    chat.messages = [
      ...chat.messages,
      {
        id: randomId(),
        content: data.content,
        createdAt: now,
        isMe: true,
      },
    ];

    chat.lastMessage = {
      content: data.content,
      createdAt: now,
    };

    chat.unreadCount = 0;

    // Ensure immutability when updating state
    const updatedChats = [
      chat,
      ...chats.slice(0, chatIndex),
      ...chats.slice(chatIndex + 1),
    ];
    setChats(updatedChats);
  };

  const value: ChatContextValue = {
    chats,
    currentChat,
    newMessage,
    setActiveChatId,
    showProfile: showProfile && !!activeChatId,
    setShowProfile,
  };

  return <ChatContextProvider value={value}>{children}</ChatContextProvider>;
}
