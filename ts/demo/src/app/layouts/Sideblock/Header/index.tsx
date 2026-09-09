// Import Dependencies
import clsx from "clsx";
import { NavLink, useLocation } from "react-router";
import {
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  LinkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { Notifications } from "@/components/template/Notifications";
import { TokenUsage } from "@/components/template/TokenUsage";
import { PromptBar } from "@/components/template/PromptBar";
import { SidebarToggleBtn } from "@/components/shared/SidebarToggleBtn";
import { Profile } from "../Profile";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useIaModals } from "@/app/contexts/ia-modals/context";
import { useAssistente } from "@/app/contexts/assistente/context";
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
  const { open: abrirAssistente, setTab } = useAssistente();

  // Abaixo de lg a barra de prompt não cabe no header (o campo colapsa a 0px),
  // então a busca vira uma lupa que abre o painel do assistente já focado.
  const abrirBusca = () => {
    setTab("chat");
    abrirAssistente();
  };

  return (
    <header
      className={clsx(
        "app-header transition-content dark:border-dark-600 sticky top-0 z-20 flex h-(--header-h) items-center gap-2 border-b border-gray-200 bg-white/80 px-(--margin-x) backdrop-blur-sm backdrop-saturate-150",
        cardSkin === "bordered" ? "dark:bg-dark-900/80" : "dark:bg-dark-700/80",
      )}
    >
      <div className="contents xl:hidden">
        <SidebarToggleBtn />
      </div>

      <Button
        onClick={() => open("upload")}
        color="primary"
        title="Upload"
        aria-label="Upload"
        className="h-9 shrink-0 gap-1.5 px-2.5 text-xs-plus sm:px-3"
      >
        <ArrowUpTrayIcon className="size-4 stroke-[1.5]" />
        <span className="hidden sm:inline">Upload</span>
      </Button>

      <div className="min-w-0 flex-1">
        <div className="hidden lg:block">
          <PromptBar />
        </div>
        <button
          type="button"
          onClick={abrirBusca}
          title={t("chrome.promptPlaceholder")}
          aria-label={t("chrome.promptPlaceholder")}
          className="dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 grid size-9 place-items-center rounded-lg text-gray-500 outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
        >
          <MagnifyingGlassIcon className="size-5 stroke-[1.5]" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <div className="me-4 ms-4 hidden md:block">
          <TokenUsage />
        </div>
        <div className="hidden items-center gap-1 md:flex">
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
        </div>
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
          "dark:text-dark-200 grid size-9 place-items-center rounded-lg text-gray-500 outline-hidden",
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
          "grid size-9 place-items-center rounded-lg outline-hidden transition-colors",
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
