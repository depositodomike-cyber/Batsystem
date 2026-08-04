// Import Dependencies
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { rankItem } from "@tanstack/match-sorter-utils";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  ColumnDef,
  FilterFn,
} from "@tanstack/react-table";
import { useDeferredValue, useMemo, useState } from "react";
import clsx from "clsx";

// Local Imports
import { CollapsibleSearch } from "@/components/shared/CollapsibleSearch";
import { Button, Card, Table, THead, TBody, Th, Tr, Td } from "@/components/ui";
import { getMultipleRandom } from "@/utils/getMultipleRandom";
import { fakeData, FakeDataItem } from "./fakeData";

// ----------------------------------------------------------------------

const users = getMultipleRandom(fakeData, 10);

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value);

  // Store the itemRank info
  addMeta({
    itemRank,
  });

  // Return if the item should be filtered in/out
  return itemRank.passed;
};

const defaultColumns: ColumnDef<FakeDataItem>[] = [
  {
    accessorKey: "id",
    id: "id",
    header: "ID",
  },
  {
    accessorKey: "firstName",
    id: "firstName",
    header: "First Name",
  },
  {
    accessorKey: "lastName",
    id: "lastName",
    header: "Last Name",
  },
  {
    accessorKey: "email",
    id: "email",
    header: "Email",
  },
  {
    accessorKey: "state",
    id: "state",
    header: "State",
  },
  {
    accessorKey: "address",
    id: "address",
    header: "Address",
  },
];

export function ColumnSizing() {
  const data = useMemo(() => [...users], []);
  const columns = useMemo<ColumnDef<FakeDataItem>[]>(
    () => [...defaultColumns],
    [],
  );

  const [globalFilter, setGlobalFilter] = useState("");
  const deferredGlobalFilter = useDeferredValue(globalFilter);

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: deferredGlobalFilter,
    },
    columnResizeMode: "onChange",
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="dark:text-dark-100 truncate text-base font-medium tracking-wide text-gray-800">
          Column Resizes
        </h2>
        <div className="flex">
          <CollapsibleSearch
            placeholder="Search here..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <Button
            onClick={() => table.resetColumnSizing()}
            variant="flat"
            isIcon
            className="size-8 rounded-full"
          >
            <ArrowPathIcon className="size-4.5" />
          </Button>
        </div>
      </div>
      <Card className="mt-3">
        <div className="min-w-full overflow-x-auto">
          <Table
            className="min-w-full text-left rtl:text-right"
            style={{ width: table.getCenterTotalSize() }}
          >
            <THead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Th
                      key={header.id}
                      className="group dark:bg-dark-800 dark:text-dark-100 relative bg-gray-200 font-semibold text-gray-800 uppercase first:ltr:rounded-tl-lg last:ltr:rounded-tr-lg first:rtl:rounded-tr-lg last:rtl:rounded-tl-lg"
                      style={{
                        width: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}

                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={clsx(
                          "absolute top-0 bottom-0 cursor-col-resize touch-none rounded-sm transition-all select-none group-hover:w-1.5 ltr:right-0 rtl:left-0",
                          header.column.getIsResizing()
                            ? "bg-primary-500 w-1.5"
                            : "dark:bg-dark-600 w-0.5 bg-gray-300",
                        )}
                      />
                    </Th>
                  ))}
                </Tr>
              ))}
            </THead>
            <TBody>
              {table.getRowModel().rows.map((row) => (
                <Tr
                  key={row.id}
                  className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200 last:border-none"
                >
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Td>
                  ))}
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
