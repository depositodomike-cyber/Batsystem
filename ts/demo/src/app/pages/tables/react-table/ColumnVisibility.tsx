// Import Dependencies
import { rankItem } from "@tanstack/match-sorter-utils";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
} from "@tanstack/react-table";
import { useDeferredValue, useMemo, useState } from "react";

// Local Imports
import { CollapsibleSearch } from "@/components/shared/CollapsibleSearch";
import { TableColumnVisibility } from "@/components/shared/table/TableColumnsVisibility";
import { Card, Table, THead, TBody, Th, Tr, Td } from "@/components/ui";
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

export function ColumnVisibility() {
  const data = useMemo(() => [...users], []);
  const columns = useMemo<ColumnDef<FakeDataItem>[]>(
    () => [...defaultColumns],
    [],
  );

  const [globalFilter, setGlobalFilter] = useState("");
  const deferredGlobalFilter = useDeferredValue(globalFilter);
  const [columnVisibility, setColumnVisibility] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: deferredGlobalFilter,
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="dark:text-dark-100 truncate text-base font-medium tracking-wide text-gray-800">
          Column Visibility
        </h2>
        <div className="flex">
          <CollapsibleSearch
            placeholder="Search here..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <TableColumnVisibility
            table={table}
            header="Select Columns"
            description="Select visible columns for the table."
          />
        </div>
      </div>
      <Card className="mt-3">
        <div className="min-w-full overflow-x-auto">
          <Table hoverable className="w-full text-left rtl:text-right">
            <THead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Th
                      key={header.id}
                      className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 font-semibold text-gray-800 uppercase first:ltr:rounded-tl-lg last:ltr:rounded-tr-lg first:rtl:rounded-tr-lg last:rtl:rounded-tl-lg"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
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
                    <Td key={cell.id}>
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
