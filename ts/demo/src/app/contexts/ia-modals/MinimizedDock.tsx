import clsx from "clsx";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { aiFunctionLabel } from "@/app/pages/ceo/ia-functions";
import { useIaModals } from "./context";
import { IA_MODALS_BY_ID } from "./registry";

// ----------------------------------------------------------------------

export function MinimizedDock() {
  const { t } = useTranslation();
  const { states, restore, close } = useIaModals();

  const minimized = Object.keys(states)
    .filter((id) => states[id] === "minimized")
    .map((id) => IA_MODALS_BY_ID[id])
    .filter(Boolean);

  if (minimized.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-3">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2">
        {minimized.map(({ id, Icon, tint }) => {
          const title = aiFunctionLabel(id);
          return (
            <div
              key={id}
              className="dark:bg-dark-700 dark:border-dark-500 flex items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pr-1 pl-3 shadow-lg ring-1 ring-black/5"
            >
              <button
                type="button"
                onClick={() => restore(id)}
                className="dark:text-dark-100 flex items-center gap-2 text-gray-700"
                title={t("ai.restore", { title })}
              >
                <Icon className={clsx("size-4 shrink-0", tint)} />
                <span className="max-w-[11rem] truncate text-xs-plus font-medium">
                  {title}
                </span>
              </button>
              <button
                type="button"
                onClick={() => close(id)}
                aria-label={t("ai.close", { title })}
                className="dark:hover:bg-dark-600 dark:text-dark-300 grid size-6 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
