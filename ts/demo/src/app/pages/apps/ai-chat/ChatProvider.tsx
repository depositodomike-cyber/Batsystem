// Import Dependencies
import { useState, ReactNode } from "react";

// Local Imports
import {
  ChatContextProvider,
  ChatContextValue,
  NewMessageData,
} from "./Chat.context";
import { fakeChats, Chat } from "./data";
import { randomId } from "@/utils/randomId";

// ----------------------------------------------------------------------

interface AnswerResponse {
  answer: string;
}

const answerPromise = (): Promise<AnswerResponse> =>
  new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          answer:
            "I bring information to your fingertips, answer your questions with clarity, and keep conversations interesting. I can handle a wide range of topics, from factual inquiries to creative writing.",
        }),
      1000,
    ),
  );

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>(fakeChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const currentChat = chats.find((chat) => chat.id === activeChatId);

  const getQuestion = async (chatId: string, messageId: string) => {
    try {
      const response = await answerPromise();
      setChats((prevChats) => {
        const updatedChats = prevChats.slice();
        const chatIndex = updatedChats.findIndex((chat) => chat.id === chatId);

        // Handle potential undefined chat
        if (chatIndex === -1) {
          console.error(`Chat with ID ${chatId} not found.`);
          return prevChats; // Return previous state if chat not found
        }

        const message = updatedChats[chatIndex].messages.find(
          (msg) => msg.id === messageId,
        );

        // Handle potential undefined message
        if (message) {
          message.a = response.answer;
        } else {
          console.error(
            `Message with ID ${messageId} not found in chat ${chatId}.`,
          );
        }

        return updatedChats;
      });
    } catch (error) {
      console.error("Error fetching AI response:", error);
    }
  };

  const newMessage = (chatId: string | null, data: NewMessageData) => {
    const now = new Date();
    const messageId = randomId();
    const updatedChats = chats.slice();

    const chatIndex = chatId
      ? updatedChats.findIndex((chat) => chat.id === chatId)
      : -1;
    const currentChatId = chatId ?? randomId();

    if (chatIndex === -1) {
      const newChat: Chat = {
        id: currentChatId,
        messages: [
          {
            id: messageId,
            q: data.content,
            a: "",
            createdAt: now,
          },
        ],
      };
      updatedChats.unshift(newChat);
      setActiveChatId(currentChatId);
      setChats([...updatedChats]);
    } else {
      const updatedChat = updatedChats[chatIndex];
      updatedChat.messages.push({
        id: messageId,
        q: data.content,
        a: "",
        createdAt: now,
      });
      updatedChats.splice(chatIndex, 1);
      setChats([updatedChat, ...updatedChats]);
    }

    getQuestion(currentChatId, messageId);
  };

  const value: ChatContextValue = {
    chats,
    currentChat,
    newMessage,
    setActiveChatId,
  };

  return <ChatContextProvider value={value}>{children}</ChatContextProvider>;
}
