// Import Dependencies
import { useState } from "react";
import clsx from "clsx";
import { NavLink } from "react-router";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { PlusIcon } from "@heroicons/react/20/solid";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { useSquadsContext } from "@/app/contexts/squads/context";
import { squadPath } from "@/app/navigation/ceoOs";
import { navigationIcons } from "@/app/navigation/icons";
import { GroupChevron } from "./GroupChevron";
import { useTranslation } from "react-i18next";

// ----------------------------------------------------------------------

const MAX_VISIBLE = 5;

export function SquadsGroup() {
  const { t } = useTranslation();
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();
  const { catalog, pinnedSquads, isPinned, toggleSquad, unpinSquad } =
    useSquadsContext();
  const [showAll, setShowAll] = useState(false);

  const handleItemClick = () => lgAndDown && closeSidebar();

  const visibleSquads = showAll
    ? pinnedSquads
    : pinnedSquads.slice(0, MAX_VISIBLE);

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
            <span>{t("sidebar.squads")}</span>
          </button>

          {/* Botão "+" abre o catálogo de squads para fixar no menu. */}
          <Popover className="relative inline-flex">
            <PopoverButton
              aria-label="Adicionar squad"
              title="Adicionar squad"
              className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 -mr-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-gray-500 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900 data-[open]:bg-gray-100 dark:data-[open]:bg-dark-300/10"
            >
              <PlusIcon className="size-4" />
            </PopoverButton>

            <Transition
              enter="transition ease-out"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel
                anchor={{ to: "bottom end", gap: 6 }}
                className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 max-h-[20rem] w-60 overflow-y-auto rounded-lg border bg-white p-1 outline-hidden dark:shadow-none"
              >
                <p className="dark:text-dark-300 px-2.5 py-1 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
                  {t("sidebar.allSquads")}
                </p>
                {catalog.map((squad) => {
                  const Icon = navigationIcons[squad.icon];
                  const active = isPinned(squad.id);
                  return (
                    <button
                      key={squad.id}
                      type="button"
                      onClick={() => toggleSquad(squad.id)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-start text-xs-plus outline-hidden transition-colors",
                        "dark:hover:bg-dark-600 hover:bg-gray-100",
                        active
                          ? "text-primary-600 dark:text-primary-400 font-semibold"
                          : "dark:text-dark-100 text-gray-800",
                      )}
                    >
                      {Icon && <Icon className="size-4.5 shrink-0 stroke-[1.5]" />}
                      <span className="min-w-0 flex-1 truncate">
                        {squad.title}
                      </span>
                      {active && <CheckIcon className="size-4 shrink-0" />}
                    </button>
                  );
                })}
              </PopoverPanel>
            </Transition>
          </Popover>
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
          {pinnedSquads.length === 0 ? (
            <p className="dark:text-dark-400 px-6 py-1.5 text-xs text-gray-400">
              {t("sidebar.noPinnedSquads")}
            </p>
          ) : (
            visibleSquads.map((squad) => {
              const Icon = navigationIcons[squad.icon];
              return (
                <div
                  key={squad.id}
                  className="group/squad relative flex items-center px-3"
                >
                  <NavLink
                    to={squadPath(squad)}
                    onClick={handleItemClick}
                    className={({ isActive }) =>
                      clsx(
                        "group min-w-0 flex-1 rounded-md px-3 py-1 font-medium outline-hidden transition-colors ease-in-out",
                        isActive
                          ? "text-primary-600 dark:text-primary-400"
                          : "dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 dark:focus:bg-dark-300/10 text-gray-800 hover:bg-gray-100 hover:text-gray-950 focus:bg-gray-100 focus:text-gray-950",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          data-menu-active={isActive}
                          className="flex min-w-0 items-center gap-2.5 text-xs tracking-wide"
                        >
                          {Icon && (
                            <Icon
                              className={clsx(
                                "size-4.5 shrink-0 stroke-[1.5]",
                                !isActive && "opacity-80 group-hover:opacity-100",
                              )}
                            />
                          )}
                          <span className="truncate">{squad.title}</span>
                        </div>
                        {isActive && (
                          <div className="bg-primary-600 dark:bg-primary-400 absolute bottom-1 top-1 w-1 ltr:left-0 ltr:rounded-r-full rtl:right-0 rtl:rounded-l-lg" />
                        )}
                      </>
                    )}
                  </NavLink>

                  {/* Remover squad fixado do menu. */}
                  <button
                    type="button"
                    onClick={() => unpinSquad(squad.id)}
                    aria-label={`Remover ${squad.title}`}
                    title="Remover do menu"
                    className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-gray-400 opacity-0 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 group-hover/squad:opacity-100"
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                </div>
              );
            })
          )}

          {pinnedSquads.length > MAX_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="dark:text-dark-400 dark:hover:bg-dark-300/10 dark:hover:text-dark-200 mx-3 mt-0.5 cursor-pointer rounded-md px-3 py-1 text-start text-xs font-medium tracking-wide text-gray-400 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              {showAll
                ? t("sidebar.showLess")
                : t("sidebar.showMore", {
                    count: pinnedSquads.length - MAX_VISIBLE,
                  })}
            </button>
          )}
        </div>
      </Collapse>
    </div>
  );
}
