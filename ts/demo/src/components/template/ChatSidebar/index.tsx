// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ChatBubbleOvalLeftIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Avatar, AvatarDot, Button, ScrollShadow } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { Header } from "./Header";
import { Conversation } from "./Conversation";
import {
  channels,
  directMessages,
  favorites,
  type ChatItem,
} from "./data";

// ----------------------------------------------------------------------

export function ChatSidebar() {
  const [isOpen, { open, close }] = useDisclosure();

  return (
    <>
      <Button
        onClick={open}
        variant="flat"
        isIcon
        className="dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 relative size-9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Chat"
        title="Chat"
      >
        <ChatBubbleOvalLeftIcon className="size-5 stroke-[1.5]" />
      </Button>
      <ChatSidebarContent isOpen={isOpen} close={close} />
    </>
  );
}

interface ChatSidebarContentProps {
  isOpen: boolean;
  close: () => void;
}

function ChatSidebarContent({ isOpen, close }: ChatSidebarContentProps) {
  const [selected, setSelected] = useState<ChatItem | null>(null);

  const handleClose = () => {
    close();
    // Reseta a seleção ao fechar para reabrir já na lista.
    setSelected(null);
  };

  return (
    <Transition show={isOpen}>
      <Dialog open={true} onClose={handleClose} static autoFocus>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="dark:bg-black/40 fixed inset-0 z-60 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        ></TransitionChild>

        <TransitionChild
          as={DialogPanel}
          enter="ease-out transform-gpu transition-transform duration-200"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in transform-gpu transition-transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
          className={clsx(
            "dark:bg-dark-750 fixed inset-y-0 right-0 z-61 flex w-screen transform-gpu flex-row bg-white transition-[transform,width] duration-200 sm:inset-y-2 sm:mx-2 sm:rounded-xl",
            selected ? "sm:w-[46rem]" : "sm:w-80",
          )}
        >
          {/* Painel de conversa (expandido) à esquerda */}
          {selected && (
            <Conversation
              item={selected}
              onBack={() => setSelected(null)}
              className="dark:border-dark-600 flex-1 border-gray-200 sm:border-r max-sm:w-screen"
            />
          )}

          {/* Lista (Favoritos, Canais, Mensagens Diretas) à direita */}
          <div
            className={clsx(
              "flex min-h-0 flex-col sm:w-80 sm:shrink-0",
              selected ? "max-sm:hidden" : "flex-1",
            )}
          >
            <Header close={handleClose} />
            <ScrollShadow
              size={4}
              className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain pb-5"
            >
              <Section
                title="Favoritos"
                items={favorites}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
              <Section
                title="Canais"
                items={channels}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
              <Section
                title="Mensagens Diretas"
                items={directMessages}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            </ScrollShadow>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------

function Section({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: ChatItem[];
  selectedId?: string;
  onSelect: (item: ChatItem) => void;
}) {
  return (
    <div className="mt-4">
      <p className="dark:text-dark-300 px-4 text-tiny-plus font-medium tracking-wide text-gray-400 uppercase">
        {title}
      </p>
      <div className="mt-1.5">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            isActive={item.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  item,
  isActive,
  onSelect,
}: {
  item: ChatItem;
  isActive: boolean;
  onSelect: (item: ChatItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={clsx(
        "flex w-full items-center gap-3 px-4 py-2 text-start transition-colors",
        isActive
          ? "bg-primary-600/10 dark:bg-primary-400/10"
          : "dark:hover:bg-dark-600 hover:bg-gray-100",
      )}
    >
      {item.type === "channel" ? (
        <div className="dark:bg-dark-600 dark:text-dark-200 grid size-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500">
          <HashtagIcon className="size-5" />
        </div>
      ) : (
        <Avatar
          size={10}
          src={item.avatar}
          name={item.name}
          initialColor="auto"
          indicator={
            item.isOnline ? (
              <AvatarDot color="success" className="right-0" />
            ) : undefined
          }
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className={clsx(
            "truncate text-sm font-medium",
            isActive
              ? "text-primary-600 dark:text-primary-400"
              : "dark:text-dark-100 text-gray-800",
          )}
        >
          {item.type === "channel" ? `# ${item.name}` : item.name}
        </p>
        <p className="dark:text-dark-300 truncate text-xs text-gray-400">
          {item.preview}
        </p>
      </div>

      {item.unread ? (
        <span className="bg-primary-600 grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-tiny font-medium text-white">
          {item.unread}
        </span>
      ) : null}
    </button>
  );
}
