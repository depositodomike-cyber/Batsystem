// Import Dependencies
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Table } from "@tanstack/react-table";

// Local Imports
import { Button } from "@/components/ui";
import { TableSettings } from "@/components/shared/table/TableSettings";
import { Order } from "./data";

// ----------------------------------------------------------------------

export function TableConfig({ table }: { table: Table<Order> }) {
  return (
    <Popover className="relative w-full">
      <PopoverButton
        isIcon
        variant="flat"
        className="size-8 rounded-full"
        as={Button}
        aria-label="Table Settings"
        title="Table Settings"
      >
        <Cog6ToothIcon className="size-5" />
      </PopoverButton>
      <Transition
        as={PopoverPanel}
        enter="transition ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
        style={{ width: "16rem", maxHeight: "27rem" }}
        anchor={{ to: "bottom end", gap: 12 }}
        className="text-xs-plus ring-primary-500/50 dark:border-dark-500 dark:bg-dark-750 absolute z-100 flex flex-col rounded-md border border-gray-300 bg-white shadow-lg shadow-gray-200/50 outline-hidden focus-visible:ring-3 focus-visible:outline-hidden dark:shadow-none"
      >
        <h3 className="text-sm-plus dark:text-dark-100 px-3 pt-2.5 font-medium tracking-wide text-gray-800">
          Table Settings
        </h3>

        <TableSettings table={table} />
      </Transition>
    </Popover>
  );
}
