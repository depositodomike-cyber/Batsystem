// Import Dependencies
import { ChevronUpIcon } from "@heroicons/react/24/outline";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  Row,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useMemo, useRef } from "react";
import clsx from "clsx";

// Local Imports
import {
  Button,
  Card,
  Collapse,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
} from "@/components/ui";
import { useBoxSize } from "@/hooks";
import { SubComponentItem, subComponent as users } from "./fakeData";

// ----------------------------------------------------------------------

const defaultColumns: ColumnDef<SubComponentItem>[] = [
  {
    id: "expand",
    header: "More",
    cell: ({ row }) => (
      <>
        {row.getCanExpand() ? (
          <Button
            isIcon
            className="size-6"
            variant="flat"
            onClick={row.getToggleExpandedHandler()}
          >
            <ChevronUpIcon
              className={clsx(
                "size-4.5 transition-transform",
                row.getIsExpanded() && "rotate-180",
              )}
            />
          </Button>
        ) : null}
      </>
    ),
  },
  {
    id: "firstName",
    accessorKey: "firstName",
    header: "First Name",
  },
  {
    id: "lastName",
    accessorKey: "lastName",
    header: "Last Name",
  },
  {
    id: "email",
    accessorKey: "email",
    header: "Email",
  },
  {
    id: "state",
    accessorKey: "state",
    header: "State",
  },
  {
    id: "address",
    accessorKey: "address",
    header: "Address",
  },
];

export function SubComponent() {
  const data = useMemo(() => [...users], []);
  const columns = useMemo(() => [...defaultColumns], []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const { width: cardWidth } = useBoxSize({ ref: cardRef });

  return (
    <div>
      <h2 className="dark:text-dark-100 truncate text-base font-medium tracking-wide text-gray-800">
        Subcomponent Table
      </h2>
      <Card className="mt-3" ref={cardRef}>
        <div className="min-w-full overflow-x-auto">
          <Table className="w-full text-left rtl:text-right">
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
              {table.getRowModel().rows.map((row) => {
                return (
                  <Fragment key={row.id}>
                    <Tr
                      key={row.id}
                      className={clsx(
                        "dark:border-b-dark-500 border-y border-transparent border-b-gray-200 last:border-none",
                        row.getIsExpanded() && "border-dashed",
                      )}
                    >
                      {/* first row is a normal row */}
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
                    <>
                      <tr hidden />
                      <tr>
                        {/* 2nd row is a custom 1 cell row */}
                        <td
                          colSpan={row.getVisibleCells().length}
                          className="p-0"
                        >
                          <Collapse in={row.getIsExpanded()}>
                            <RenderSubComponent
                              row={row}
                              cardWidth={cardWidth}
                            />
                          </Collapse>
                        </td>
                      </tr>
                    </>
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function RenderSubComponent({
  row,
  cardWidth,
}: {
  row: Row<SubComponentItem>;
  cardWidth?: number;
}) {
  const cols = ["#", "Name", "Job", "FAVORITE COLOR"];

  return (
    <div
      className="dark:border-b-dark-500 sticky border-b border-b-gray-200 pt-3 pb-4 ltr:left-0 rtl:right-0"
      style={{ maxWidth: cardWidth }}
    >
      <div className="min-w-full overflow-x-auto px-4 sm:px-5">
        <Table hoverable className="w-full text-left rtl:text-right">
          <THead>
            <Tr>
              {cols.map((title, index) => (
                <Th
                  key={index}
                  className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 font-semibold text-gray-800 uppercase first:ltr:rounded-l-lg last:ltr:rounded-r-lg first:rtl:rounded-r-lg last:rtl:rounded-l-lg"
                >
                  {title}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {row.original.subComponentData.map((tr) => (
              <Tr
                key={tr.uid}
                className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200"
              >
                <Td className="ltr:rounded-l-lg rtl:rounded-r-lg">{tr.uid}</Td>
                <Td>{tr.name}</Td>
                <Td>{tr.job}</Td>
                <Td className="ltr:rounded-r-lg rtl:rounded-l-lg">
                  {tr.favColor}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="px-4 pt-2 text-end sm:px-5">
        <button
          onClick={() => row.toggleExpanded(false)}
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 cursor-pointer border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
