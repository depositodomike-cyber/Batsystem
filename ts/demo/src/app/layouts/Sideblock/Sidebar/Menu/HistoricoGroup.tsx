// Import Dependencies
import { useState } from "react";
import clsx from "clsx";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { useChatsContext } from "@/app/contexts/chats/context";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useMoverChatParaGrupo } from "@/app/pages/ceo/useGrupoMemoria";
import { SidebarListItem } from "./SidebarListItem";
import { GroupChevron } from "./GroupChevron";
import { useTranslation } from "react-i18next";

// ----------------------------------------------------------------------

const MAX_VISIBLE = 5;

export function HistoricoGroup({ product }: { product: string }) {
  const { t } = useTranslation();
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();
  const { chatsByProduct, renameChat, removeChat } = useChatsContext();
  const { projectsByProduct } = useProjectsContext();
  const moverChatParaGrupo = useMoverChatParaGrupo();
  const [showAll, setShowAll] = useState(false);

  const deleteMessages = {
    pending: {
      title: t("sidebar.deleteChatTitle"),
      description:
        "Tem certeza de que deseja excluir este chat do histórico? Esta ação não pode ser desfeita.",
      actionText: t("sidebar.delete"),
    },
  };

  // Histórico mostra apenas chats soltos; os movidos para um grupo somem daqui
  // e passam a aparecer na página do grupo.
  const chats = chatsByProduct(product).filter((c) => !c.projectId);
  const visibleChats = showAll ? chats : chats.slice(0, MAX_VISIBLE);
  const groups = projectsByProduct(product).map((p) => ({
    id: p.id,
    title: p.title,
  }));

  const handleItemClick = () => lgAndDown && closeSidebar();

  return (
    <div className="pt-3">
      <div
        className={clsx(
          "sticky top-0 z-10 bg-white px-6",
          cardSkin === "bordered" ? "dark:bg-dark-900" : "dark:bg-dark-750",
        )}
      >
        <div className="mb-2 flex items-center justify-between pt-2">
          <button
            onClick={toggle}
            className="dark:text-dark-300 dark:hover:text-dark-50 dark:focus:text-dark-50 flex cursor-pointer items-center gap-2 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase outline-hidden hover:text-gray-900 focus:text-gray-900"
          >
            <GroupChevron open={isOpened} />
            <span>{t("sidebar.history")}</span>
          </button>
        </div>
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-linear-to-b from-white to-transparent",
            cardSkin === "bordered" ? "dark:from-dark-900" : "dark:from-dark-750",
          )}
        ></div>
      </div>

      <Collapse in={isOpened}>
        <div className="flex flex-col space-y-0.5">
          {chats.length === 0 ? (
            <p className="dark:text-dark-400 px-6 py-1.5 text-xs text-gray-400">
              {t("sidebar.noChats")}
            </p>
          ) : (
            visibleChats.map((chat) => (
              <SidebarListItem
                key={chat.id}
                to={`/${product}/historico/${chat.id}`}
                title={chat.title}
                icon={ChatBubbleLeftRightIcon}
                onNavigate={handleItemClick}
                onRename={(title) => renameChat(chat.id, title)}
                onDelete={() => removeChat(chat.id)}
                renameLabel={t("sidebar.renameChat")}
                confirmMessages={deleteMessages}
                groups={groups}
                currentGroupId={chat.projectId}
                onMoveToGroup={(groupId) =>
                  moverChatParaGrupo(chat.id, groupId)
                }
              />
            ))
          )}

          {chats.length > MAX_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="dark:text-dark-400 dark:hover:bg-dark-300/10 dark:hover:text-dark-200 mx-3 mt-0.5 cursor-pointer rounded-md px-3 py-1 text-start text-xs font-medium tracking-wide text-gray-400 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              {showAll
                ? t("sidebar.showLess")
                : t("sidebar.showMore", {
                    count: chats.length - MAX_VISIBLE,
                  })}
            </button>
          )}
        </div>
      </Collapse>
    </div>
  );
}
