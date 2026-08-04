// Import Dependencies
import dayjs from "dayjs";
import { Getter, Column } from "@tanstack/react-table";

// Local Imports
import { Badge, BadgeProps } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { Highlight } from "@/components/shared/Highlight";
import { ensureString } from "@/utils/ensureString";
import { Invoice, InvoiceStatusType } from "./invoiceList";

// ----------------------------------------------------------------------

const statusColor: Record<InvoiceStatusType, BadgeProps["color"]> = {
  pending: "neutral",
  paid: "success",
  unfunded: "error",
};

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function InvoiceName({
  getValue,
  column,
}: {
  getValue: Getter<any>;
  column: Column<Invoice>;
}) {
  const columnQuery = ensureString(column.getFilterValue());

  return (
    <p className="dark:text-dark-100 font-medium text-gray-800">
      <Highlight query={columnQuery}>{getValue()}</Highlight>
    </p>
  );
}

export function Date({ getValue }: { getValue: Getter<any> }) {
  const { locale } = useLocaleContext();
  const date = dayjs(+getValue()).locale(locale).format("DD MMM YYYY");
  return <span>{date}</span>;
}

export function Amount({ getValue }: { getValue: Getter<any> }) {
  return <> {formatter.format(getValue())}</>;
}

export function Status({ getValue }: { getValue: Getter<any> }) {
  const val = getValue();
  return (
    <Badge
      color={statusColor[val.toLowerCase() as InvoiceStatusType]}
      className="capitalize"
    >
      {val}
    </Badge>
  );
}

export function Download() {
  return (
    <div className="text-end">
      <a
        href="##"
        className="text-primary-600 dark:text-primary-400 mx-auto border-b border-dashed border-current pb-0.5"
      >
        Download
      </a>
    </div>
  );
}
