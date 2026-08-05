// Import Dependencies
import { Portal } from "@headlessui/react";
import { clsx } from "clsx";

// Local Imports
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useDidUpdate } from "@/hooks";
import { Header } from "./Header";
import { Menu } from "./Menu";
import { LanguageSelect } from "./LanguageSelect";

// ----------------------------------------------------------------------

export function Sidebar() {
  const { cardSkin } = useThemeContext();
  const { name, lgAndDown } = useBreakpointsContext();

  const { isExpanded: isSidebarExpanded, close: closeSidebar } =
    useSidebarContext();

  useDidUpdate(() => {
    if (isSidebarExpanded) closeSidebar();
  }, [name]);

  return (
    <div
      className={clsx(
        "sidebar-panel",
        cardSkin === "shadow"
          ? "shadow-soft dark:shadow-dark-900/60"
          : "border-gray-200 dark:border-dark-600/80 ltr:border-r rtl:border-l",
      )}
    >
      <div
        className={clsx(
          "flex h-full grow flex-col bg-white",
          cardSkin === "shadow" ? "dark:bg-dark-750" : "dark:bg-dark-900",
        )}
      >
        <Header />
        <div className="flex min-h-0 flex-1 flex-col">
          <Menu />
          <LanguageSelect />
        </div>
      </div>

      {lgAndDown && isSidebarExpanded && (
        <Portal>
          <div
            onClick={closeSidebar}
            className="fixed inset-0 z-20 bg-gray-900/50 backdrop-blur-sm transition-opacity dark:bg-black/40"
          />
        </Portal>
      )}
    </div>
  );
}
