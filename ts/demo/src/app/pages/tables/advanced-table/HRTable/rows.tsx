// Import Dependencies
import { ChevronUpIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Getter, Row, Table } from "@tanstack/react-table"

// Local Imports
import { Avatar, Button } from "@/components/ui";
import { ColorKey, setThisClass } from "@/utils/setThisClass";
import { Highlight } from "@/components/shared/Highlight";
import { ensureString } from "@/utils/ensureString";
;
// ----------------------------------------------------------------------

const statusColors: Record<string, ColorKey> = {
  "full-time": "primary",
  "part-time": "secondary",
  contractor: "info",
  intern: "warning",
  freelance: "success",
};

export function IdCell({
  row,
  getValue,
  table,
}: {
  row: Row<any>;
  getValue: Getter<any>;
  table: Table<any>;
}) {
  const query = ensureString(table.getState().globalFilter);

  return (
    <div className="-mx-2 flex items-center space-x-2">
      {row.getCanExpand() ? (
        <Button
          isIcon
          className="size-5"
          variant="flat"
          onClick={row.getToggleExpandedHandler()}
        >
          <ChevronUpIcon
            className={clsx(
              "size-4 transition-transform",
              row.getIsExpanded() && "rotate-180",
            )}
          />
        </Button>
      ) : null}
      <span>
        <Highlight query={query}>{getValue()}</Highlight>
      </span>
    </div>
  );
}

export function NameCell({
  row,
  getValue,
  table,
}: {
  row: Row<any>;
  getValue: Getter<any>;
  table: Table<any>;
}) {
  const name = getValue();
  const query = ensureString(table.getState().globalFilter);

  return (
    <div className="flex items-center space-x-4">
      <Avatar
        size={9}
        name={name}
        initialColor="auto"
        src={row.original.avatar}
        classNames={{ initial: "text-xs-plus" }}
      />
      <span className="dark:text-dark-100 font-medium text-gray-800">
        <Highlight query={query}>{name}</Highlight>
      </span>
    </div>
  );
}

export function PositionCell({
  getValue,
  table,
}: {
  getValue: Getter<any>;
  table: Table<any>;
}) {
  const query = ensureString(table.getState().globalFilter);

  return (
    <p className="dark:text-dark-100 font-medium text-gray-800">
      <Highlight query={query}>{getValue()}</Highlight>
    </p>
  );
}

export function DepartmentCell({
  getValue,
  table,
}: {
  getValue: Getter<any>;
  table: Table<any>;
}) {
  const query = ensureString(table.getState().globalFilter);

  return (
    <p className="text-xs-plus w-48 truncate">
      <Highlight query={query}>{getValue()}</Highlight>
    </p>
  );
}

export function StatusCell({
  getValue,
  row,
  table,
}: {
  getValue: Getter<any>;
  row: Row<any>;
  table: Table<any>;
}) {
  const query = ensureString(table.getState().globalFilter);
  return (
    <span className="inline-flex items-center space-x-2 leading-none">
      <span
        className={clsx(
          "border-this dark:border-this-light size-3 rounded-full border-2",
          setThisClass(statusColors[row.original.status.key]),
        )}
      ></span>
      <span>
        <Highlight query={query}>{getValue()}</Highlight>
      </span>
    </span>
  );
}
