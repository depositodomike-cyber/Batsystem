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

// ----------------------------------------------------------------------

const MAX_VISIBLE = 5;

const deleteMessages = {
  pending: {
    title: "Excluir grupo?",
    description:
      "Tem certeza de que deseja excluir este grupo? As instruções, fontes e memória vinculadas serão perdidas. Esta ação não pode ser desfeita.",
    actionText: "Excluir",
  },
};

export function AgrupamentosGroup({ product }: { product: string }) {
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();
  const { projectsByProduct, openCreate, renameProject, removeProject } =
    useProjectsContext();
  const [showAll, setShowAll] = useState(false);

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
            <span>Grupos</span>
          </button>
          <button
            onClick={openCreate}
            aria-label="Criar grupo"
            title="Criar grupo"
            className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 -mr-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-gray-500 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900"
          >
            <PlusIcon className="size-4" />
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
          {projects.length === 0 ? (
            <p className="dark:text-dark-400 px-6 py-1.5 text-xs text-gray-400">
              Nenhum grupo. Use o + para criar.
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
                renameLabel="Renomear grupo"
                confirmMessages={deleteMessages}
              />
            ))
          )}

          {projects.length > MAX_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="dark:text-dark-400 dark:hover:bg-dark-300/10 dark:hover:text-dark-200 mx-3 mt-0.5 cursor-pointer rounded-md px-3 py-1 text-start text-xs font-medium tracking-wide text-gray-400 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              {showAll
                ? "Mostrar menos"
                : `Mostrar mais (${projects.length - MAX_VISIBLE})`}
            </button>
          )}
        </div>
      </Collapse>
    </div>
  );
}
