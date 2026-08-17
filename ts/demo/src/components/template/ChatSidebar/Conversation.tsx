// Import Dependencies
import { useMemo, useState } from "react";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import {
  ChevronLeftIcon,
  HashtagIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Avatar, Button, Input, ScrollShadow } from "@/components/ui";
import { getConversation, type ChatItem, type ConvMessage } from "./data";

// ----------------------------------------------------------------------

const TABS = ["Mensagens", "Enviados", "Recebidos", "Combinados"] as const;

interface ConversationProps {
  item: ChatItem;
  onBack: () => void;
  className?: string;
}

export function Conversation({ item, onBack, className }: ConversationProps) {
  const allMessages = useMemo(() => getConversation(item), [item]);
  const [draft, setDraft] = useState("");

  const subtitle =
    item.type === "channel" ? "Canal · Anúncios e trabalho" : "Mensagem direta";

  return (
    <div className={clsx("flex min-w-0 flex-col", className)}>
      {/* Header com imagem e título */}
      <div className="dark:border-dark-600 flex items-center gap-3 border-b border-gray-200 px-4 py-2.5">
        <Button
          onClick={onBack}
          variant="flat"
          isIcon
          className="size-7 shrink-0 rounded-lg sm:hidden"
          aria-label="Voltar"
        >
          <ChevronLeftIcon className="size-5" />
        </Button>

        {item.type === "channel" ? (
          <div className="dark:bg-dark-600 dark:text-dark-200 grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500">
            <HashtagIcon className="size-5" />
          </div>
        ) : (
          <Avatar
            size={9}
            src={item.avatar}
            name={item.name}
            initialColor="auto"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="dark:text-dark-100 truncate font-medium text-gray-800">
            {item.type === "channel" ? `# ${item.name}` : item.name}
          </p>
          <p className="dark:text-dark-300 truncate text-xs text-gray-400">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Abas + conteúdo */}
      <TabGroup as="div" className="flex min-h-0 flex-1 flex-col">
        <TabList className="dark:border-dark-600 flex shrink-0 gap-1 border-b border-gray-200 px-2">
          {TABS.map((tab) => (
            <Tab
              key={tab}
              className={({ selected }) =>
                clsx(
                  "shrink-0 border-b-2 px-2.5 py-2 text-xs-plus font-medium outline-hidden transition-colors",
                  selected
                    ? "border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                    : "dark:text-dark-300 dark:hover:text-dark-100 border-transparent text-gray-500 hover:text-gray-800",
                )
              }
            >
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="min-h-0 flex-1">
          <TabPanel className="h-full">
            <MessageList messages={allMessages} />
          </TabPanel>
          <TabPanel className="h-full">
            <MessageList
              messages={allMessages.filter((m) => m.author === "me")}
              emptyLabel="Nada enviado ainda."
            />
          </TabPanel>
          <TabPanel className="h-full">
            <MessageList
              messages={allMessages.filter((m) => m.author === "them")}
              emptyLabel="Nada recebido ainda."
            />
          </TabPanel>
          <TabPanel className="h-full">
            <MessageList
              messages={allMessages.filter((m) => m.agreement)}
              emptyLabel="Nenhum combinado registrado."
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Rodapé para escrever */}
      <div className="dark:border-dark-600 shrink-0 border-t border-gray-200 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDraft("");
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              item.type === "channel"
                ? `Enviar mensagem para #${item.name}`
                : `Mensagem para ${item.name}`
            }
            className="rounded-lg"
            classNames={{ root: "flex-1" }}
          />
          <Button
            type="submit"
            isIcon
            color="primary"
            className="size-9 shrink-0 rounded-lg"
            aria-label="Enviar"
          >
            <PaperAirplaneIcon className="size-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

function MessageList({
  messages,
  emptyLabel,
}: {
  messages: ConvMessage[];
  emptyLabel?: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="dark:text-dark-300 grid h-full place-items-center px-4 text-center text-sm text-gray-400">
        {emptyLabel ?? "Sem mensagens."}
      </div>
    );
  }

  return (
    <ScrollShadow
      size={4}
      className="hide-scrollbar h-full space-y-4 overflow-y-auto overscroll-contain p-4"
    >
      {messages.map((message) => {
        const isMe = message.author === "me";
        return (
          <div
            key={message.id}
            className={clsx("flex items-end gap-2", isMe && "flex-row-reverse")}
          >
            <Avatar
              size={8}
              src={message.avatar}
              name={message.name}
              initialColor="auto"
            />
            <div
              className={clsx(
                "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                isMe
                  ? "bg-primary-600 text-white"
                  : "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
              <span
                className={clsx(
                  "mt-1 block text-tiny",
                  isMe ? "text-white/70" : "dark:text-dark-300 text-gray-400",
                )}
              >
                {message.time}
              </span>
            </div>
          </div>
        );
      })}
    </ScrollShadow>
  );
}
