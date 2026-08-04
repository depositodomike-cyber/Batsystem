// Import Dependencies
import { useEffect } from "react";

// Local Imports
import { useChatContext } from "../../Chat.context";
import { ContactMessage } from "./ContactMessage";
import { MyMessage } from "./MyMessage";
import { Message } from "../../data";

// ----------------------------------------------------------------------

export interface MessageType {
  message: Message;
  i: number;
  isLastMessageOfGroup: (message: Message, i: number) => boolean;
  isFirstMessageOfGroup: (message: Message, i: number) => boolean;
}

export function Messages() {
  const { currentChat } = useChatContext();

  useEffect(() => {
    if (!currentChat) return;
    const scroll = document.querySelector("[data-conversation-panel]");
    scroll?.scrollTo({
      top: scroll.scrollHeight,
    });
  }, [currentChat, currentChat?.messages.length]);

  if (!currentChat) return null;

  const isFirstMessageOfGroup: MessageType["isFirstMessageOfGroup"] = (
    message,
    i,
  ) => {
    return (
      i === 0 ||
      (currentChat.messages[i - 1] &&
        currentChat.messages[i - 1].isMe !== message.isMe)
    );
  };

  const isLastMessageOfGroup: MessageType["isLastMessageOfGroup"] = (
    message,
    i,
  ) => {
    return (
      currentChat.messages.length - 1 === i ||
      (currentChat.messages[i + 1] &&
        currentChat.messages[i + 1].isMe !== message.isMe)
    );
  };

  return (
    <div
      data-conversation-panel
      data-conversation-panel-id={currentChat.id}
      className="transition-content custom-scrollbar grow overflow-y-auto px-[calc(var(--margin-x)-.5rem)] py-5"
    >
      {currentChat.messages.map((message, i) =>
        message.isMe ? (
          <MyMessage
            key={message.id}
            {...{ isLastMessageOfGroup, isFirstMessageOfGroup, message, i }}
          />
        ) : (
          <ContactMessage
            key={message.id}
            {...{
              isLastMessageOfGroup,
              isFirstMessageOfGroup,
              profile: currentChat.profile,
              message,
              i,
            }}
          />
        ),
      )}
    </div>
  );
}
