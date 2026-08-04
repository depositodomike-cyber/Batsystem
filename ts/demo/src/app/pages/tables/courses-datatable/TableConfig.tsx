// Import Dependencies
import { ViewColumnsIcon } from "@heroicons/react/24/outline";
import { Table } from "@tanstack/react-table";

// Local Imports
import { TableSettings } from "@/components/shared/table/TableSettings";
import { ResponsiveFilter } from "@/components/shared/table/ResponsiveFilter";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { Course } from "./data";

// ----------------------------------------------------------------------

export function TableConfig({ table }: { table: Table<Course> }) {
  const { smAndDown } = useBreakpointsContext();
  return (
    <ResponsiveFilter
      anchor={{ to: "bottom end", gap: 12 }}
      buttonContent={
        <>
          <ViewColumnsIcon className="size-4" />
          <span>View</span>
        </>
      }
      classNames={{
        button: "border-solid!",
      }}
    >
      {smAndDown ? (
        <div className="dark:border-dark-500 mx-auto flex h-12 w-full shrink-0 items-center justify-between border-b border-gray-200 px-3">
          <p className="dark:text-dark-50 truncate text-start text-base font-medium text-gray-800">
            Table View
          </p>
        </div>
      ) : (
        <h3 className="text-sm-plus dark:text-dark-100 px-3 pt-2.5 font-medium tracking-wide text-gray-800">
          Table View
        </h3>
      )}

      <div className="flex flex-col max-sm:overflow-hidden sm:w-64">
        <TableSettings table={table} />
      </div>
    </ResponsiveFilter>
  );
}
