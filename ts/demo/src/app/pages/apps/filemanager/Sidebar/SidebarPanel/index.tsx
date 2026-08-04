// Import Dependencies
import clsx from "clsx";
import { PlusIcon } from "@heroicons/react/20/solid";

// Local Imports
import { Button, ScrollShadow } from "@/components/ui";
import { useThemeContext } from "@/app/contexts/theme/context";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Menu } from "./Menu";
import { FilesTree } from "./FilesTree";

// ----------------------------------------------------------------------

export function SidebarPanel() {
  const { cardSkin } = useThemeContext();

  return (
    <div
      className={clsx(
        "prime-panel flex flex-col",
        cardSkin === "shadow"
          ? "shadow-soft dark:shadow-dark-900/60"
          : "dark:border-dark-600/80 ltr:border-r rtl:border-l",
      )}
    >
      <div
        className={clsx(
          "flex h-full grow flex-col bg-white ltr:pl-(--main-panel-width) rtl:pr-(--main-panel-width)",
          cardSkin === "shadow" ? "dark:bg-dark-750" : "dark:bg-dark-900",
        )}
      >
        <Header />
        {/* Sidebar Content */}
        <ScrollShadow className="hide-scrollbar grow overflow-y-auto">
          <div className="px-4 pt-2">
            <Button variant="outlined" className="w-full gap-2 rounded-full">
              <PlusIcon className="size-4" />
              <span>Create New</span>
            </Button>
          </div>
          <FilesTree />
          <div className="dark:bg-dark-500 mx-4 my-4 h-px bg-gray-200" />
          <Menu />
        </ScrollShadow>
        <Footer />
      </div>
    </div>
  );
}
