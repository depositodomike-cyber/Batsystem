// Import Dependencies
import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon } from "@heroicons/react/20/solid";

// Local Imports
import { Avatar, Badge, Swap, SwapOff, SwapOn } from "@/components/ui";
import { StyledSwitch } from "@/components/shared/form/StyledSwitch";
import { rolesOptions } from "./data";
import { Highlight } from "@/components/shared/Highlight";
import { ensureString } from "@/utils/ensureString";
import { Getter, Row, Column, Table } from "@tanstack/react-table";
import { User } from "./data";

// ----------------------------------------------------------------------

export function NameCell({
  row,
  getValue,
  column,
  table,
}: {
  row: Row<User>;
  getValue: Getter<any>;
  column: Column<User>;
  table: Table<User>;
}) {
  const globalQuery = ensureString(table.getState().globalFilter);
  const columnQuery = ensureString(column.getFilterValue());

  return (
    <div className="flex items-center space-x-3 ltr:-ml-1 rtl:-mr-1">
      <Swap
        effect="flip"
        disabled={!row.getCanSelect()}
        onChange={(val) => row.toggleSelected(val === "on")}
        value={row.getIsSelected() ? "on" : "off"}
      >
        <SwapOn className="flex size-10 items-center justify-center p-1">
          <div className="bg-primary-500 flex h-full w-full items-center justify-center rounded-full">
            <CheckIcon className="size-5 text-white" />
          </div>
        </SwapOn>
        <SwapOff>
          <Avatar
            size={10}
            classNames={{
              root: "dark:group-hover/tr:border-dark-300 rounded-full border-2 border-dashed border-transparent p-0.5 transition-colors group-hover/tr:border-gray-400",
              display: "text-xs-plus",
            }}
            src={row.original.avatar}
            initialColor="auto"
            name={row.original.name}
          />
        </SwapOff>
      </Swap>

      <div className="dark:text-dark-100 font-medium text-gray-800">
        <Highlight query={[globalQuery, columnQuery]}>{getValue()}</Highlight>
      </div>
    </div>
  );
}

export function RoleCell({ getValue }: { getValue: Getter<any> }) {
  const val = getValue();
  const option = rolesOptions.find((item) => item.value === val);

  return (
    <Badge color={option?.color} variant="outlined">
      {option?.label}
    </Badge>
  );
}

export function StatusCell({
  getValue,
  row: { index },
  column: { id },
  table,
}: {
  getValue: Getter<any>;
  row: Row<User>;
  column: Column<User>;
  table: Table<User>;
}) {
  const val = getValue();
  const [loading, setLoading] = useState(false);

  const onChange = async (checked: boolean) => {
    setLoading(true);
    setTimeout(() => {
      table.options.meta?.updateData?.(index, id, checked);
      toast.success("User status updated");
      setLoading(false);
    }, 1000);
  };

  return (
    <StyledSwitch
      className="mx-auto"
      checked={val}
      onChange={onChange}
      loading={loading}
    />
  );
}
