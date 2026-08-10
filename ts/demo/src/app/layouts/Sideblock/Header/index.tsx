// Import Dependencies
import clsx from "clsx";
import { NavLink, useLocation } from "react-router";
import {
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Notifications } from "@/components/template/Notifications";
import { TokenUsage } from "@/components/template/TokenUsage";
import { PromptBar } from "@/components/template/PromptBar";
import { SidebarToggleBtn } from "@/components/shared/SidebarToggleBtn";
import { Profile } from "../Profile";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useIaModals } from "@/app/contexts/ia-modals/context";
import {
  getProductCodeFromPath,
  systemAreaPath,
} from "@/app/navigation/ceoOs";
import { useTranslation } from "react-i18next";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
  type TemporarilyDisabledFeature,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

const SYSTEM_AREA_FEATURE: Partial<Record<string, TemporarilyDisabledFeature>> =
  {
    conectores: "connectors",
  };

export function Header() {
  const { cardSkin } = useThemeContext();
  const { pathname } = useLocation();
  const productCode = getProductCodeFromPath(pathname);
  const { t } = useTranslation();
  const { open } = useIaModals();

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

      <button
        type="button"
        onClick={() => open("upload")}
        title="Upload"
        aria-label="Upload"
        className="dark:border-dark-500 dark:bg-dark-700 dark:text-dark-200 dark:hover:bg-dark-600 dark:hover:text-dark-50 flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100/70 px-3 text-xs-plus font-medium text-gray-600 transition-colors hover:bg-gray-200/70 hover:text-gray-900"
      >
        <ArrowUpTrayIcon className="size-4 stroke-[1.5]" />
        <span>Upload</span>
      </button>

      <div className="min-w-0 flex-1">
        <PromptBar />
      </div>

      <div className="flex items-center gap-1">
        <div className="ms-4 me-4">
          <TokenUsage />
        </div>
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
  const feature = SYSTEM_AREA_FEATURE[slug];
  const disabled =
    feature != null && isFeatureTemporarilyDisabled(feature);

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title={label}
        aria-label={label}
        className={clsx(
          "dark:text-dark-200 grid size-9 place-items-center rounded-full text-gray-500 outline-hidden",
          DISABLED_MENU_CLASS,
        )}
      >
        <Icon className="size-5 stroke-[1.5]" />
      </span>
    );
  }

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
