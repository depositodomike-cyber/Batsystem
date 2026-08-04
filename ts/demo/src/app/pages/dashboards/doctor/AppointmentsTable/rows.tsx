// Import Dependencies
import dayjs from "dayjs";
import { ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Table, Row, Getter } from "@tanstack/react-table";

// Local Imports
import { Avatar } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { ensureString } from "@/utils/ensureString";
import { Highlight } from "@/components/shared/Highlight";
import { Appointment } from "./fakeData";

// ----------------------------------------------------------------------

export function NameCell({
  row,
  getValue,
  table,
}: {
  row: Row<Appointment>;
  getValue: Getter<string>;
  table: Table<Appointment>;
}) {
  const globalQuery = ensureString(table.getState().globalFilter);
  const val = getValue();

  return (
    <div className="flex items-center gap-4">
      <Avatar
        size={9}
        src={row.original.avatar}
        name={row.original.name}
        initialColor="auto"
        classNames={{ display: "text-sm" }}
      />
      <div className="dark:text-dark-100 font-medium text-gray-800">
        <Highlight query={globalQuery}>{val}</Highlight>
      </div>
    </div>
  );
}

export function LocationCell({
  table,
  getValue,
}: {
  table: Table<Appointment>;
  getValue: Getter<string>;
}) {
  const globalQuery = ensureString(table.getState().globalFilter);
  const val = getValue();

  return (
    <a href="##" className="hover:underline focus:underline">
      <Highlight query={globalQuery}>{val}</Highlight>
    </a>
  );
}

export function DateTimeCell({ getValue }: { getValue: Getter<string> }) {
  const { locale } = useLocaleContext();
  const time = dayjs(getValue()).locale(locale).format("ddd, D MMM - HH:mm");

  return (
    <span className="dark:text-dark-100 font-medium text-gray-800">{time}</span>
  );
}

export function StatusCell({ getValue }: { getValue: Getter<string> }) {
  const status = getValue();

  if (status === "pending") return <ClockIcon className="ml-4 size-5" />;

  return (
    <XCircleIcon className="text-error dark:text-error-light ml-4 size-5" />
  );
}
