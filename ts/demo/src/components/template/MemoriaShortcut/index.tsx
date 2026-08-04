// Import Dependencies
import { NavLink, useLocation } from "react-router";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import {
  getProductCodeFromPath,
  systemAreaPath,
} from "@/app/navigation/ceoOs";

// ----------------------------------------------------------------------

// Atalho fixo para a área de Diretrizes no menu superior.
// É um ícone permanente (não gerenciado pelo menu "Funcionalidades").
export function MemoriaShortcut() {
  const { pathname } = useLocation();
  const productCode = getProductCodeFromPath(pathname);

  return (
    <NavLink
      to={systemAreaPath(productCode, "memoria")}
      title="Diretrizes"
      aria-label="Diretrizes"
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
