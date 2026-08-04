// Import Dependencies
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { ProductSwitcher } from "./ProductSwitcher";

// ----------------------------------------------------------------------

export function Header() {
  const { close } = useSidebarContext();
  return (
    <header className="relative flex h-[61px] shrink-0 items-center gap-1 px-3">
      <div className="min-w-0 flex-1">
        <ProductSwitcher />
      </div>
      <div className="xl:hidden">
        <Button
          onClick={close}
          variant="flat"
          isIcon
          className="size-6 rounded-full"
        >
          <ChevronLeftIcon className="size-5 rtl:rotate-180" />
        </Button>
      </div>
    </header>
  );
}
