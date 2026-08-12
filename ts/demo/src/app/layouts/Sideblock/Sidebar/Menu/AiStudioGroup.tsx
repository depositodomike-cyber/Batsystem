// Import Dependencies
import { useMemo } from "react";
import { NavLink } from "react-router";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

// Local Imports
import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import {
  AiFunction,
  FUNCTIONS,
  isAiStudioFunctionDisabled,
} from "@/app/pages/ceo/ia-functions";
import { GroupChevron } from "./GroupChevron";

// ----------------------------------------------------------------------

function AiStudioItem({
  item,
  to,
  onNavigate,
  disabled,
}: {
  item: AiFunction;
  to: string;
  onNavigate: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { Icon, tint, id, label: fallback } = item;
  const label = t(`ai.${id}`, { defaultValue: fallback });

  const content = (
    <div className="flex min-w-0 items-center gap-2.5 text-xs tracking-wide">
      <Icon
        className={clsx(
          "size-4.5 shrink-0 stroke-[1.5]",
          disabled ? "opacity-80" : "opacity-80 group-hover:opacity-100",
          tint,
        )}
      />
      <span className="truncate">{label}</span>
    </div>
  );

  return (
    <div className="relative flex px-3">
      {disabled ? (
        <div
          aria-disabled="true"
          title={t("ai.unavailable")}
          className="dark:text-dark-200 min-w-0 flex-1 cursor-not-allowed rounded-md px-3 py-1 font-medium text-gray-800 opacity-40 outline-hidden"
        >
          {content}
        </div>
      ) : (
        <NavLink
          to={to}
          onClick={onNavigate}
          className="group dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 dark:focus:bg-dark-300/10 min-w-0 flex-1 rounded-md px-3 py-1 font-medium text-gray-800 outline-hidden transition-colors ease-in-out hover:bg-gray-100 hover:text-gray-950 focus:bg-gray-100 focus:text-gray-950"
        >
          {content}
        </NavLink>
      )}
    </div>
  );
}

export function AiStudioGroup({ product }: { product: string }) {
  const { t, i18n } = useTranslation();
  const [isOpened, { toggle }] = useDisclosure(true);
  const { cardSkin } = useThemeContext();
  const { lgAndDown } = useBreakpointsContext();
  const { close: closeSidebar } = useSidebarContext();

  const handleItemClick = () => lgAndDown && closeSidebar();
  const itemPath = (id: string) => `/${product}/ia?fn=${id}`;

  const items = useMemo(
    () =>
      [...FUNCTIONS].sort((a, b) => {
        const la = t(`ai.${a.id}`, { defaultValue: a.label });
        const lb = t(`ai.${b.id}`, { defaultValue: b.label });
        return la.localeCompare(lb, i18n.language, { sensitivity: "base" });
      }),
    [t, i18n.language],
  );

  return (
    <div className="pt-3">
      <div
        className={clsx(
          "sticky top-0 z-10 bg-white px-6",
          cardSkin === "bordered" ? "dark:bg-dark-900" : "dark:bg-dark-750",
        )}
      >
        <div className="mb-1.5 flex w-full items-center gap-2 pt-2 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
          <button
            type="button"
            onClick={toggle}
            aria-label={
              isOpened
                ? t("sidebar.collapseAiStudio")
                : t("sidebar.expandAiStudio")
            }
            className="dark:text-dark-300 dark:hover:text-dark-50 dark:focus:text-dark-50 flex cursor-pointer items-center outline-hidden hover:text-gray-900 focus:text-gray-900"
          >
            <GroupChevron open={isOpened} />
          </button>
          <NavLink
            to={`/${product}/ia`}
            onClick={handleItemClick}
            className="dark:text-dark-300 dark:hover:text-dark-50 dark:focus:text-dark-50 min-w-0 flex-1 cursor-pointer truncate outline-hidden hover:text-gray-900 focus:text-gray-900"
          >
            {t("sidebar.aiStudio")}
          </NavLink>
        </div>
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-linear-to-b from-white to-transparent",
            cardSkin === "bordered"
              ? "dark:from-dark-900"
              : "dark:from-dark-750",
          )}
        ></div>
      </div>

      <Collapse in={isOpened}>
        <div className="flex flex-col space-y-0.5">
          {items.map((item) => (
            <AiStudioItem
              key={item.id}
              item={item}
              to={itemPath(item.id)}
              onNavigate={handleItemClick}
              disabled={isAiStudioFunctionDisabled(item.id)}
            />
          ))}
        </div>
      </Collapse>
    </div>
  );
}
