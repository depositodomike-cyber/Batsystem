// Local Imports
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { useState } from "react";

// Import Dependencies
import { CollapsibleSearch } from "@/components/shared/CollapsibleSearch";
import { PaginationSection } from "./PaginationSection";
import { SelectedRowsActions } from "./SelectedRowsActions";
import { Card, Table, TBody, Tr, Td } from "@/components/ui";
import { useDidUpdate } from "@/hooks";
import { fuzzyFilter } from "@/utils/react-table/fuzzyFilter";
import { useSkipper } from "@/utils/react-table/useSkipper";
import { MenuAction } from "./MenuActions";
import { columns } from "./columns";
import { tourList } from "./fakeData";
import { getUserAgentBrowser } from "@/utils/dom/getUserAgentBrowser";

// ----------------------------------------------------------------------

const isSafari = getUserAgentBrowser() === "Safari";

export function ToursTable() {
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  const [tours, setTours] = useState([...tourList]);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: tours,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    meta: {
      deleteRow: (row) => {
        // Skip page index reset until after next rerender
        skipAutoResetPageIndex();
        setTours((old) =>
          old.filter((oldRow) => oldRow.tour_id !== row.original.tour_id),
        );
      },
      deleteRows: (rows) => {
        // Skip page index reset until after next rerender
        skipAutoResetPageIndex();
        const rowIds = rows.map((row) => row.original.tour_id);
        setTours((old) => old.filter((row) => !rowIds.includes(row.tour_id)));
      },
    },
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    getCoreRowModel: getCoreRowModel(),

    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: fuzzyFilter,

    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),

    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex,
  });

  useDidUpdate(() => table.resetRowSelection(), [tours]);

  return (
    <Card className="flex flex-col">
      <div className="table-toolbar mt-3 flex items-center justify-between px-4 sm:px-5">
        <h2 className="dark:text-dark-100 truncate text-base font-medium tracking-wide text-gray-800">
          Tours Table
        </h2>
        <div className="flex">
          <CollapsibleSearch
            placeholder="Search here..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <MenuAction />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-5">
        <div className="from-info to-info-darker relative flex flex-col overflow-hidden rounded-lg bg-linear-to-br p-3.5">
          <p className="text-xs text-sky-100 uppercase">Total Booking</p>
          <div className="flex items-end justify-between space-x-2">
            <p className="mt-4 text-2xl font-medium text-white">31,556</p>
            <a
              href="##"
              className="truncate border-b border-dotted border-current pb-0.5 text-xs font-medium text-sky-100 outline-hidden transition-colors duration-300 hover:text-white focus:text-white"
            >
              Get Report
            </a>
          </div>
          <div className="mask is-reuleaux-triangle absolute top-0 right-0 -m-3 size-16 bg-white/20"></div>
        </div>
        <div className="relative flex flex-col overflow-hidden rounded-lg bg-linear-to-br from-amber-400 to-orange-600 p-3.5">
          <p className="text-xs text-amber-50 uppercase">Total Revenue</p>
          <div className="flex items-end justify-between space-x-2">
            <p className="mt-4 text-2xl font-medium text-white">$61,556</p>
            <a
              href="##"
              className="truncate border-b border-dotted border-current pb-0.5 text-xs font-medium text-amber-50 outline-hidden transition-colors duration-300 hover:text-white focus:text-white"
            >
              Get Report
            </a>
          </div>
          <div className="mask is-diamond absolute top-0 right-0 -m-3 size-16 bg-white/20"></div>
        </div>
        <div className="relative flex flex-col overflow-hidden rounded-lg bg-linear-to-br from-pink-500 to-rose-500 p-3.5">
          <p className="text-xs text-pink-100 uppercase">Total Debt</p>
          <div className="flex items-end justify-between space-x-2">
            <p className="mt-4 text-2xl font-medium text-white">$12,556</p>
            <a
              href="##"
              className="truncate border-b border-dotted border-current pb-0.5 text-xs font-medium text-pink-100 outline-hidden transition-colors duration-300 hover:text-white focus:text-white"
            >
              Get Report
            </a>
          </div>
          <div className="mask is-hexagon-2 absolute top-0 right-0 -m-3 size-16 bg-white/20"></div>
        </div>
      </div>
      <div className="relative mt-5">
        <div className="table-wrapper min-w-full overflow-x-auto">
          <Table hoverable className="w-full text-left rtl:text-right">
            <TBody>
              {table.getRowModel().rows.map((row) => {
                return (
                  <Tr
                    key={row.id}
                    className={clsx(
                      "dark:border-b-dark-500 relative border-y border-transparent border-b-gray-200",
                      row.getIsSelected() &&
                        !isSafari &&
                        "row-selected after:bg-primary-500/10 ltr:after:border-l-primary-500 rtl:after:border-r-primary-500 after:pointer-events-none after:absolute after:inset-0 after:z-2 after:h-full after:w-full after:border-3 after:border-transparent",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <Td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </Td>
                      );
                    })}
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
        {table.getCoreRowModel().rows.length && (
          <div className="p-4 sm:px-5">
            <PaginationSection table={table} />
          </div>
        )}{" "}
        <SelectedRowsActions table={table} />
      </div>
    </Card>
  );
}
