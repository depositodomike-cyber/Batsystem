// Import Dependencies
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import { NavLink } from "react-router";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import invariant from "tiny-invariant";

// Local Imports
import {
  AccordionButton,
  AccordionItem,
  AccordionPanel,
} from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { MenuItem } from "./MenuItem";
import { type NavigationTree } from "@/@types/navigation";
import { navigationIcons } from "@/app/navigation/icons";

// ----------------------------------------------------------------------

export function CollapsibleItem({ data }: { data: NavigationTree }) {
  const { id, path, transKey, icon, childs, title } = data;
  const { t } = useTranslation();
  const { isRtl } = useLocaleContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close } = useSidebarContext();

  invariant(path, `[CollapsibleItem] path is required for navigation item`);

  invariant(
    icon && navigationIcons[icon],
    `[CollapsibleItem] Icon "${icon}" not found in navigationIcons registry for item: ${path}`,
  );

  invariant(
    childs && childs.length > 0,
    `[CollapsibleItem] At least one child item is required for collapsible menu: ${path}`,
  );

  const label = transKey ? t(transKey) : title;
  const ChevronIcon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  const Icon = navigationIcons[icon];

  return (
    <AccordionItem value={path ?? id} className="flex flex-1 flex-col">
      {({ open }) => (
        <>
          {/* Cabeçalho: o rótulo navega (NavLink, mesmo estilo dos itens
              irmãos) e o chevron à direita expande/recolhe os subitens. */}
          <div className="relative flex items-center px-3">
            <NavLink
              to={path}
              onClick={() => lgAndDown && close()}
              className={({ isActive }) =>
                clsx(
                  "group min-w-0 flex-1 rounded-md px-3 py-1 font-medium outline-hidden transition-colors ease-in-out",
                  isActive
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-gray-800 hover:bg-gray-100 hover:text-gray-950 focus:bg-gray-100 focus:text-gray-950 dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 dark:focus:bg-dark-300/10",
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
                    <span className="truncate">{label}</span>
                  </div>
                  {isActive && (
                    <div className="absolute bottom-1 top-1 w-1 bg-primary-600 dark:bg-primary-400 ltr:left-0 ltr:rounded-r-full rtl:right-0 rtl:rounded-l-lg" />
                  )}
                </>
              )}
            </NavLink>
            <AccordionButton className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 ml-1 flex shrink-0 cursor-pointer items-center rounded-md p-1 text-gray-400 outline-hidden hover:bg-gray-100 hover:text-gray-700">
              <ChevronIcon
                className={clsx(
                  "size-4 shrink-0 transition-transform",
                  open && "ltr:rotate-90 rtl:-rotate-90",
                )}
              />
            </AccordionButton>
          </div>
          <AccordionPanel className="flex flex-col space-y-1 py-1.5 ps-3">
            {childs.map((child) => (
              <MenuItem key={child.id} data={child} />
            ))}
          </AccordionPanel>
        </>
      )}
    </AccordionItem>
  );
}
