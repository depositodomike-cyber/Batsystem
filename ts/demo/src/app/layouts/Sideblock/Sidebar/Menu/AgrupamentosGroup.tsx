// Import Dependencies
import { useState } from "react";
import clsx from "clsx";
import { FolderIcon } from "@heroicons/react/24/outline";
import { PlusIcon } from "@heroicons/react/20/solid";

// Local Imports
import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { SidebarListItem } from "./SidebarListItem";
import { GroupChevron } from "./GroupChevron";
import { useTranslation } from "react-i18next";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

const MAX_VISIBLE = 5;

export function AgrupamentosGroup({ product }: { product: string }) {
  const { t } = useTranslation();
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();
  const { projectsByProduct, openCreate, renameProject, removeProject } =
    useProjectsContext();
  const [showAll, setShowAll] = useState(false);
  const disabled = isFeatureTemporarilyDisabled("groups");

  const deleteMessages = {
    pending: {
      title: t("sidebar.deleteGroupTitle"),
      description:
        "Tem certeza de que deseja excluir este grupo? As instruções, fontes e memória vinculadas serão perdidas. Esta ação não pode ser desfeita.",
      actionText: t("sidebar.delete"),
    },
  };

  const projects = projectsByProduct(product);
  const visibleProjects = showAll ? projects : projects.slice(0, MAX_VISIBLE);

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
            <span>{t("sidebar.groups")}</span>
          </button>
          {disabled ? (
            <span
              aria-disabled="true"
              aria-label={t("sidebar.createGroup")}
              title={t("sidebar.createGroup")}
              className={clsx(
                "-mr-1 grid size-5 shrink-0 place-items-center rounded-full text-gray-500 outline-hidden",
                DISABLED_MENU_CLASS,
              )}
            >
              <PlusIcon className="size-4" />
            </span>
          ) : (
            <button
              onClick={openCreate}
              aria-label={t("sidebar.createGroup")}
              title={t("sidebar.createGroup")}
              className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 -mr-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-gray-500 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900"
            >
              <PlusIcon className="size-4" />
            </button>
          )}
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
          {projects.length === 0 ? (
            <p
              className={clsx(
                "dark:text-dark-400 px-6 py-1.5 text-xs text-gray-400",
                disabled && DISABLED_MENU_CLASS,
              )}
            >
              {t("sidebar.noGroups")}
            </p>
          ) : (
            visibleProjects.map((project) => (
              <SidebarListItem
                key={project.id}
                to={`/${product}/agrupamentos/${project.id}`}
                title={project.title}
                icon={FolderIcon}
                onNavigate={handleItemClick}
                onRename={(title) => renameProject(project.id, title)}
                onDelete={() => removeProject(project.id)}
                renameLabel={t("sidebar.renameGroup")}
                confirmMessages={deleteMessages}
                disabled={disabled}
              />
            ))
          )}

          {projects.length > MAX_VISIBLE && !disabled && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="dark:text-dark-400 dark:hover:bg-dark-300/10 dark:hover:text-dark-200 mx-3 mt-0.5 cursor-pointer rounded-md px-3 py-1 text-start text-xs font-medium tracking-wide text-gray-400 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              {showAll
                ? t("sidebar.showLess")
                : t("sidebar.showMore", {
                    count: projects.length - MAX_VISIBLE,
                  })}
            </button>
          )}
        </div>
      </Collapse>
    </div>
  );
}
