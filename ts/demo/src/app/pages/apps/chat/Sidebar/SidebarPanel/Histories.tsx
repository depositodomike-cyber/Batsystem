// Import Dependencies
import { PlusIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button } from "@/components/ui";
import { histories } from "../../data";

// ----------------------------------------------------------------------

export function Histories() {
  return (
    <div>
      <div className="flex min-w-0 items-center justify-between px-4">
        <span className="text-xs-plus truncate font-medium uppercase">
          History
        </span>
        <div className="flex ltr:-mr-1.5 rtl:-ml-1.5">
          <Button variant="flat" isIcon className="size-6 rounded-full">
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="hide-scrollbar mt-1 flex min-w-0 snap-x scroll-px-3 gap-2.5 overflow-x-auto px-3">
        {histories.map((history) => (
          <div
            key={history.uid}
            className="flex w-11 min-w-0 shrink-0 snap-start flex-col items-center justify-center"
          >
            <Avatar
              component="button"
              size={11}
              name={history.name}
              src={history.avatar}
              classNames={{
                root: "rounded-full bg-linear-to-r from-purple-500 to-orange-600 p-0.5",
                display: "dark:border-dark-700 border-2 border-white text-sm",
              }}
              initialColor="auto"
            />
            <p className="mt-1 w-12 truncate text-center text-xs tracking-tight">
              {history.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
