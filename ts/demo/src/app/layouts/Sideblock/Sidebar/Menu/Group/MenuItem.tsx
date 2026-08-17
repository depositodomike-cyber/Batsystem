// Import Dependencies
import clsx from "clsx";
import { NavLink, useRouteLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import invariant from "tiny-invariant";

// Local Imports
import { Badge } from "@/components/ui";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { type NavigationTree } from "@/@types/navigation";
import { navigationIcons } from "@/app/navigation/icons";
import {
  DISABLED_MENU_CLASS,
  isNavItemTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

// Classes do item: separadas do JSX porque o item pode ser link (NavLink) ou
// botão (quando abre um modal em vez de navegar) e os dois usam o mesmo visual.
const ITEM_CLASS =
  "group min-w-0 flex-1 rounded-md px-3 py-1 font-medium outline-hidden transition-colors ease-in-out";
const ITEM_IDLE_CLASS =
  "text-gray-800 hover:bg-gray-100 hover:text-gray-950 focus:bg-gray-100 focus:text-gray-950 dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 dark:focus:bg-dark-300/10";

export function MenuItem({
  data,
  onSelect,
  active: activeOverride,
}: {
  data: NavigationTree;
  /**
   * Quando informado, o item abre algo na tela atual (ex.: modal de upload) em
   * vez de navegar — vira botão e nunca fica com estado "ativo" de rota.
   */
  onSelect?: () => void;
  /** Força o estado ativo (ex.: Home cobre Grafo e Lista). */
  active?: boolean;
}) {
  const { icon, path, id, transKey, title } = data;
  const { lgAndDown } = useBreakpointsContext();
  const { close } = useSidebarContext();
  const { t } = useTranslation();

  invariant(
    icon && navigationIcons[icon],
    `[MenuItem] Icon ${icon} not found in navigationIcons`,
  );

  invariant(path, "[MenuItem] path is required but not found");

  const Icon = navigationIcons[icon];

  const label = transKey ? t(transKey) : title;

  const info = useRouteLoaderData("root")?.[id]?.info;

  const handleMenuItemClick = () => lgAndDown && close();

  const disabled = isNavItemTemporarilyDisabled(id, path);

  const body = (isActive: boolean) => (
    <>
      <div
        data-menu-active={disabled ? false : isActive}
        className="flex min-w-0 items-center justify-between gap-2 text-xs tracking-wide"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <Icon
              className={clsx(
                "size-4.5 shrink-0 stroke-[1.5]",
                !disabled && !isActive && "opacity-80 group-hover:opacity-100",
              )}
            />
          )}
          <span className="truncate">{label}</span>
        </div>
        {info && info.val && (
          <Badge
            color={info.color}
            variant="soft"
            className="h-4.5 min-w-[1rem] shrink-0 p-[5px] text-tiny-plus"
          >
            {info.val}
          </Badge>
        )}
      </div>
      {!disabled && isActive && (
        <div className="absolute bottom-1 top-1 w-1 bg-primary-600 dark:bg-primary-400 ltr:left-0 ltr:rounded-r-full rtl:right-0 rtl:rounded-l-lg" />
      )}
    </>
  );

  return (
    <div className="relative flex px-3">
      {disabled ? (
        <div
          aria-disabled="true"
          className={clsx(
            "dark:text-dark-200 group min-w-0 flex-1 rounded-md px-3 py-1 font-medium text-gray-800 outline-hidden",
            DISABLED_MENU_CLASS,
          )}
        >
          {body(false)}
        </div>
      ) : onSelect ? (
        <button
          type="button"
          onClick={() => {
            onSelect();
            handleMenuItemClick();
          }}
          className={clsx(ITEM_CLASS, ITEM_IDLE_CLASS, "text-start")}
        >
          {body(false)}
        </button>
      ) : (
        <NavLink
          to={path}
          onClick={handleMenuItemClick}
          className={({ isActive }) => {
            const on = activeOverride ?? isActive;
            return clsx(
              ITEM_CLASS,
              on
                ? "text-primary-600 dark:text-primary-400"
                : ITEM_IDLE_CLASS,
            );
          }}
        >
          {({ isActive }) => body(activeOverride ?? isActive)}
        </NavLink>
      )}
    </div>
  );
}
