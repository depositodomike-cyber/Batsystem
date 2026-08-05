// Import Dependencies
import { NavLink, useLocation } from "react-router";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import {
  getProductCodeFromPath,
  systemAreaPath,
} from "@/app/navigation/ceoOs";
import { useTranslation } from "react-i18next";

// ----------------------------------------------------------------------

export function MemoriaShortcut() {
  const { pathname } = useLocation();
  const productCode = getProductCodeFromPath(pathname);
  const { t } = useTranslation();
  const label = t("chrome.guidelines");

  return (
    <NavLink
      to={systemAreaPath(productCode, "memoria")}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        clsx(
          "grid size-9 place-items-center rounded-full outline-hidden transition-colors",
          isActive
            ? "text-primary-600 dark:text-primary-400 bg-primary-600/10 dark:bg-primary-400/10"
            : "dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900",
        )
      }
    >
      <CircleStackIcon className="size-5 stroke-[1.5]" />
    </NavLink>
  );
}
