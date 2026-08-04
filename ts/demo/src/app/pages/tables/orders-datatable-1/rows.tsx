// Import Dependencies
import dayjs from "dayjs";
import clsx from "clsx";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { Column, Getter, Table, Row } from "@tanstack/react-table";
import invariant from "tiny-invariant";

// Local Imports
import { Highlight } from "@/components/shared/Highlight";
import { Avatar, Badge, Tag } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { ensureString } from "@/utils/ensureString";
import { type Order, OrderStatus, orderStatusOptions } from "./data";

// ----------------------------------------------------------------------

export function OrderIdCell({ getValue }: { getValue: Getter<any> }) {
  return (
    <span className="text-primary-600 dark:text-primary-400 font-medium">
      {getValue()}
    </span>
  );
}

export function DateCell({ getValue }: { getValue: Getter<any> }) {
  const { locale } = useLocaleContext();
  const timestapms = getValue();
  const date = dayjs(Number(timestapms)).locale(locale).format("DD MMM YYYY");
  const time = dayjs(Number(timestapms)).locale(locale).format("hh:mm A");

  return (
    <>
      <p className="font-medium">{date}</p>
      <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">{time}</p>
    </>
  );
}

export function CustomerCell({
  row,
  getValue,
  column,
  table,
}: {
  row: Row<Order>;
  getValue: Getter<any>;
  column: Column<Order>;
  table: Table<Order>;
}) {
  const globalQuery = ensureString(table.getState().globalFilter);
  const columnQuery = ensureString(column.getFilterValue());

  const name = getValue();

  return (
    <div className="flex items-center gap-4">
      <Avatar
        size={9}
        name={name}
        src={row.original.customer.avatar_img}
        classNames={{
          display: "mask is-squircle rounded-none text-sm",
        }}
      />
      <span className="dark:text-dark-100 font-medium text-gray-800">
        <Highlight query={[globalQuery, columnQuery]}>{name}</Highlight>
      </span>
    </div>
  );
}

export function TotalCell({ getValue }: { getValue: Getter<any> }) {
  return (
    <p className="text-sm-plus dark:text-dark-100 font-medium text-gray-800">
      ${getValue().toFixed(1)}
    </p>
  );
}

export function ProfitCell({
  getValue,
  row,
}: {
  getValue: Getter<any>;
  row: Row<Order>;
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="dark:text-dark-100 text-gray-800">
        ${getValue().toFixed(1)}
      </p>
      <Badge className="rounded-full" color="success" variant="soft">
        {((row.original.profit / row.original.total) * 100).toFixed(0)}%
      </Badge>
    </div>
  );
}

export function OrderStatusCell({
  getValue,
  row,
  column,
  table,
}: {
  getValue: Getter<any>;
  row: Row<Order>;
  column: Column<Order>;
  table: Table<Order>;
}) {
  const val = getValue();
  const option = orderStatusOptions.find((item) => item.value === val);
  invariant(option, "Order status option not found");

  const handleChangeStatus = (status: OrderStatus) => {
    table.options.meta?.updateData?.(row.index, column.id, status);
    toast.success(`Order status updated to ${option.label}`);
  };

  return (
    <Listbox onChange={handleChangeStatus} value={val}>
      <ListboxButton
        as={Tag}
        component="button"
        color={option.color}
        className="cursor-pointer gap-1.5"
      >
        {option.icon && <option.icon className="h-4 w-4" />}

        <span>{option.label}</span>
      </ListboxButton>
      <Transition
        as={ListboxOptions}
        enter="transition ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
        anchor={{ to: "bottom start", gap: "8px" }}
        className="text-xs-plus shadow-soft dark:border-dark-500 dark:bg-dark-750 z-100 max-h-60 w-40 overflow-auto rounded-lg border border-gray-300 bg-white py-1 capitalize outline-hidden focus-visible:outline-hidden dark:shadow-none"
      >
        {orderStatusOptions.map((item) => (
          <ListboxOption
            key={item.value}
            value={item.value}
            className={({ focus }) =>
              clsx(
                "dark:text-dark-100 relative flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-gray-800 outline-hidden transition-colors select-none",
                focus && "dark:bg-dark-600 bg-gray-100",
              )
            }
          >
            {({ selected }) => (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {item.icon && <item.icon className="size-4.5 stroke-1" />}
                  <span className="block truncate">{item.label}</span>
                </div>
                {selected && <CheckIcon className="-mr-1 size-4.5 stroke-1" />}
              </div>
            )}
          </ListboxOption>
        ))}
      </Transition>
    </Listbox>
  );
}

export function AddressCell({
  getValue,
  column,
  table,
}: {
  getValue: Getter<any>;
  column: Column<Order>;
  table: Table<Order>;
}) {
  const globalQuery = ensureString(table.getState().globalFilter);
  const columnQuery = ensureString(column.getFilterValue());
  const val = getValue();

  return (
    <p className="text-xs-plus w-48 truncate xl:w-56 2xl:w-64">
      <Highlight query={[globalQuery, columnQuery]}>{val}</Highlight>
    </p>
  );
}
