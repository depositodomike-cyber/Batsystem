// Import Dependencies
import { Fragment } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { PiSlidersHorizontalFill } from "react-icons/pi";
import { MdFileDownload } from "react-icons/md";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { TbCurrencyDollar } from "react-icons/tb";
import { Table } from "@tanstack/react-table";

// Local Imports
import { RangeFilter } from "@/components/shared/table/RangeFilter";
import { FacedtedFilter } from "@/components/shared/table/FacedtedFilter";
import { DateFilter } from "@/components/shared/table/DateFilter";
import { invoiceStatus } from "./invoiceList";
import { Button, Collapse, Input } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { Invoice } from "./invoiceList";

// ----------------------------------------------------------------------

export function Toolbar({ table }: { table: Table<Invoice> }) {
  const [showFilters, { toggle }] = useDisclosure(false, {
    onClose: () => queueMicrotask(() => table.resetColumnFilters()),
  });

  const invoiceNameColumn = table.getColumn("invoice_name");

  return (
    <div className="table-toolbar mt-5 flex flex-col">
      <div className="flex justify-between gap-2">
        <div className="flex gap-2">
          {invoiceNameColumn && (
            <Input
              value={(invoiceNameColumn?.getFilterValue() as string) ?? ""}
              onChange={(e) =>
                invoiceNameColumn?.setFilterValue(e.target.value)
              }
              prefix={<MagnifyingGlassIcon className="size-4" />}
              className="ring-primary-500/50 h-8 text-xs focus:ring-3"
              placeholder="Search Name..."
            />
          )}
          <Button
            onClick={toggle}
            color={showFilters ? "primary" : "neutral"}
            className="h-8 space-x-2 px-2.5 text-xs whitespace-nowrap"
          >
            <PiSlidersHorizontalFill className="size-4" />
            <span className="max-sm:hidden">Filter</span>
          </Button>
        </div>

        <Menu as="div" className="relative inline-block text-start">
          <MenuButton
            as={Button}
            className="h-8 space-x-2 px-2.5 text-xs whitespace-nowrap"
          >
            <MdFileDownload className="size-4" />
            <span className="max-sm:hidden">Export</span>
          </MenuButton>
          <Transition
            as={Fragment}
            enter="transition ease-out"
            enterFrom="opacity-0 translate-y-2"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-2"
          >
            <MenuItems className="dark:border-dark-500 dark:bg-dark-700 absolute z-100 mt-1.5 min-w-[11rem] rounded-lg border border-gray-300 bg-white py-1 font-medium whitespace-nowrap shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden ltr:right-0 rtl:left-0 dark:shadow-none">
              <MenuItem>
                {({ focus }) => (
                  <button
                    className={clsx(
                      "flex h-9 w-full items-center px-3 tracking-wide outline-hidden transition-colors",
                      focus &&
                        "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                    )}
                  >
                    <span>Export as CSV</span>
                  </button>
                )}
              </MenuItem>
              <MenuItem>
                {({ focus }) => (
                  <button
                    className={clsx(
                      "flex h-9 w-full items-center px-3 tracking-wide outline-hidden transition-colors",
                      focus &&
                        "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                    )}
                  >
                    <span>Export as PDF</span>
                  </button>
                )}
              </MenuItem>
            </MenuItems>
          </Transition>
        </Menu>
      </div>
      <Collapse in={showFilters}>
        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-3 sm:-mx-5 sm:px-5">
          <Filters table={table} />
        </div>
      </Collapse>
    </div>
  );
}

function Filters({ table }: { table: Table<Invoice> }) {
  return (
    <>
      {table.getColumn("status") && (
        <FacedtedFilter
          options={invoiceStatus}
          column={table.getColumn("status")!}
          title="Status"
          Icon={CheckCircleIcon}
        />
      )}

      {table.getColumn("invoice_date") && (
        <DateFilter
          column={table.getColumn("invoice_date")!}
          title="Date Range"
          config={{
            maxDate: new Date(new Date().setDate(new Date().getDate() + 1)),
            mode: "range",
          }}
        />
      )}

      {table.getColumn("amount") && (
        <RangeFilter
          column={table.getColumn("amount")!}
          title="Amount"
          Icon={TbCurrencyDollar}
          MinPrefixIcon={TbCurrencyDollar}
          MaxPrefixIcon={TbCurrencyDollar}
          buttonText={({ min, max }) => (
            <>
              {min && <>From ${min}</>}
              {min && max && " - "}
              {max && <>To ${max}</>}
            </>
          )}
        />
      )}
    </>
  );
}
