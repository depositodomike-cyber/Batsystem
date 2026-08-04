// Import Dependencies
import clsx from "clsx";
import { Table } from "@tanstack/react-table";

// Local Imports
import { TableConfig } from "./TableConfig";
import { Order } from "./data";
import { CollapsibleSearch } from "@/components/shared/CollapsibleSearch";
import { MenuActions } from "./MenuActions";

// ----------------------------------------------------------------------

export function Toolbar({ table }: { table: Table<Order> }) {
  const isFullScreenEnabled = table.getState().tableSettings?.enableFullScreen;

  return (
    <div
      className={clsx(
        "flex items-center justify-between",
        isFullScreenEnabled && "px-4 sm:px-5",
      )}
    >
      <h2 className="dark:text-dark-100 truncate text-base font-medium tracking-wide text-gray-800">
        Orders Table
      </h2>
      <div
        className={clsx("flex", isFullScreenEnabled && "ltr:-mr-2 rtl:-ml-2")}
      >
        <CollapsibleSearch
          placeholder="Search here..."
          value={table.getState().globalFilter}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
        />
        <TableConfig table={table} />
        <MenuActions />
      </div>
    </div>
  );
}
