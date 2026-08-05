// Import Dependencies
import clsx from "clsx";
import { NavLink, useLocation } from "react-router";
import { Cog6ToothIcon, LinkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Notifications } from "@/components/template/Notifications";
import { MemoriaShortcut } from "@/components/template/MemoriaShortcut";
import { TokenUsage } from "@/components/template/TokenUsage";
import { PromptBar } from "@/components/template/PromptBar";
import { SidebarToggleBtn } from "@/components/shared/SidebarToggleBtn";
import { Profile } from "../Profile";
import { useThemeContext } from "@/app/contexts/theme/context";
import {
  getProductCodeFromPath,
  systemAreaPath,
} from "@/app/navigation/ceoOs";
import { useTranslation } from "react-i18next";

// ----------------------------------------------------------------------

export function Header() {
  const { cardSkin } = useThemeContext();
  const { pathname } = useLocation();
  const productCode = getProductCodeFromPath(pathname);
  const { t } = useTranslation();

  return (
    <header
      className={clsx(
        "app-header transition-content dark:border-dark-600 sticky top-0 z-20 flex h-[65px] items-center gap-2 border-b border-gray-200 bg-white/80 px-(--margin-x) backdrop-blur-sm backdrop-saturate-150",
        cardSkin === "bordered" ? "dark:bg-dark-900/80" : "dark:bg-dark-700/80",
      )}
    >
      <div className="contents xl:hidden">
        <SidebarToggleBtn />
      </div>

      <div className="min-w-0 flex-1">
        <PromptBar />
      </div>

      <div className="flex items-center gap-1">
        <div className="ms-4 me-4">
          <TokenUsage />
        </div>
        <MemoriaShortcut />
        <SystemAreaLink
          productCode={productCode}
          slug="conectores"
          label={t("chrome.connectors")}
          icon={LinkIcon}
        />
        <SystemAreaLink
          productCode={productCode}
          slug="configuracoes"
          label={t("chrome.settings")}
          icon={Cog6ToothIcon}
        />
        <Notifications />
        <Profile />
      </div>
    </header>
  );
}

// ----------------------------------------------------------------------

/** Ícone fixo do menu superior que leva a uma área de sistema do produto. */
function SystemAreaLink({
  productCode,
  slug,
  label,
  icon: Icon,
}: {
  productCode: string;
  slug: string;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <NavLink
      to={systemAreaPath(productCode, slug)}
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
      <Icon className="size-5 stroke-[1.5]" />
    </NavLink>
  );
}
