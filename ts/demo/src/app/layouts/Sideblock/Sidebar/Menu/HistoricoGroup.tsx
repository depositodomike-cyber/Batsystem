import clsx from "clsx";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { PlusIcon } from "@heroicons/react/20/solid";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { agruparPorPeriodo } from "@/app/pages/ceo/conversas-periodo";
import { SidebarListItem } from "./SidebarListItem";
import { GroupChevron } from "./GroupChevron";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";

const MAX_VISIBLE = 5;

export function HistoricoGroup({ product }: { product: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();
  const { items, rename, remove } = useConversasContext();
  const disabled = isFeatureTemporarilyDisabled("history");

  const deleteMessages = {
    pending: {
      title: t("sidebar.deleteChatTitle"),
      description:
        "Tem certeza de que deseja excluir esta conversa? Esta ação não pode ser desfeita.",
      actionText: t("sidebar.delete"),
    },
  };

  const recentes = items.slice(0, MAX_VISIBLE);
  const grupos = agruparPorPeriodo(recentes).map((g) => ({
    ...g,
    rotulo:
      g.periodo === "hoje"
        ? "Hoje"
        : g.periodo === "ontem"
          ? "Ontem"
          : "Últimos dias",
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
          {disabled ? (
            <span
              aria-disabled="true"
              aria-label={t("sidebar.newConversation")}
              title={t("sidebar.newConversation")}
              className={clsx(
                "-mr-1 grid size-5 shrink-0 place-items-center rounded-lg text-gray-500 outline-hidden",
                DISABLED_MENU_CLASS,
              )}
            >
              <PlusIcon className="size-4" />
            </span>
          ) : (
            <NavLink
              to={`/${product}/conversas`}
              end
              onClick={handleItemClick}
              aria-label={t("sidebar.newConversation")}
              title={t("sidebar.newConversation")}
              className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 -mr-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-lg text-gray-500 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900"
            >
              <PlusIcon className="size-4" />
            </NavLink>
          )}
        </div>
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-linear-to-b from-white to-transparent",
            cardSkin === "bordered"
              ? "dark:from-dark-900"
              : "dark:from-dark-750",
          )}
        />
      </div>

      <Collapse in={isOpened}>
        <div className="flex flex-col space-y-0.5">
          {recentes.length === 0 ? (
            <p
              className={clsx(
                "dark:text-dark-400 px-6 py-1.5 text-xs text-gray-400",
                disabled && DISABLED_MENU_CLASS,
              )}
            >
              {t("sidebar.noChats")}
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.periodo} className="pt-1">
                <p className="dark:text-dark-400 px-6 pb-0.5 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
                  {g.rotulo}
                </p>
                {g.items.map((c) => (
                  <SidebarListItem
                    key={c.id}
                    to={`/${product}/conversas/${c.id}`}
                    title={c.title}
                    icon={ChatBubbleLeftRightIcon}
                    onNavigate={handleItemClick}
                    onRename={(title) => void rename(c.id, title)}
                    onDelete={() => {
                      void remove(c.id).then(() => {
                        if (pathname.includes(`/conversas/${c.id}`)) {
                          navigate(`/${product}/conversas`);
                        }
                      });
                    }}
                    renameLabel={t("sidebar.renameChat")}
                    confirmMessages={deleteMessages}
                    disabled={disabled}
                  />
                ))}
              </div>
            ))
          )}

          {!disabled && (
            <NavLink
              to={`/${product}/conversas/historico`}
              onClick={handleItemClick}
              className="dark:text-dark-400 dark:hover:bg-dark-300/10 dark:hover:text-dark-200 mx-3 mt-0.5 cursor-pointer rounded-md px-3 py-1 text-start text-xs font-medium tracking-wide text-gray-400 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              {t("sidebar.viewHistory")}
            </NavLink>
          )}
        </div>
      </Collapse>
    </div>
  );
}
