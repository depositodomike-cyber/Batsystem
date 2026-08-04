// Import Dependencies
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Getter, Row } from "@tanstack/react-table";

// Local Imports
import { Avatar, Badge, Progress } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { ColorType } from "@/constants/app";
import { Subscription } from "./fakeData";

// ----------------------------------------------------------------------

dayjs.extend(utc);

type License = "standard" | "premium" | "creative";

function getLicenseValiityColor(diff: number): ColorType {
  if (diff < 0) return "error";
  if (diff < 15) return "warning";
  if (diff < 50) return "info";
  return "success";
}

const licenseColor: Record<License, ColorType> = {
  standard: "info",
  premium: "primary",
  creative: "secondary",
};

export function ClientNameCell({
  row,
  getValue,
}: {
  row: Row<Subscription>;
  getValue: Getter<any>;
}) {
  const name = getValue();
  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={name}
        src={row.original.user_image}
        size={9}
        classNames={{ display: "rounded-lg text-sm" }}
      />
      <span className="dark:text-dark-100 font-medium text-gray-800">
        {name}
      </span>
    </div>
  );
}

export function LicenseType({ getValue }: { getValue: Getter<string> }) {
  const val = getValue();
  return (
    <Badge color={licenseColor[val.toLowerCase() as License]} isGlow>
      {val}
    </Badge>
  );
}

export function PurchaseDateCell({ getValue }: { getValue: Getter<any> }) {
  const { locale } = useLocaleContext();
  return <span>{dayjs(getValue()).locale(locale).format("DD MMMM YYYY")}</span>;
}

export function LicenseValiityCell({
  row,
  getValue,
}: {
  row: Row<Subscription>;
  getValue: Getter<any>;
}) {
  const length = dayjs(row.original.renewal_date).diff(
    row.original.purchase_date,
  );
  const diff = getValue();

  const color = getLicenseValiityColor((diff / length) * 100);
  return (
    <div
      data-tooltip
      data-tooltip-content={`${(diff / 86400000).toFixed(0)} days`}
    >
      <Progress value={(diff / length) * 100} color={color} variant="soft" />
    </div>
  );
}

export function RenewalDateCell({ getValue }: { getValue: Getter<any> }) {
  const { locale } = useLocaleContext();
  return (
    <span className="dark:text-dark-100 font-medium text-gray-800">
      {dayjs(getValue()).locale(locale).format("DD MMMM YYYY")}
    </span>
  );
}

export function AmountCell({ getValue }: { getValue: Getter<any> }) {
  return (
    <span className="dark:text-dark-100 font-medium text-gray-800">
      {getValue()}
    </span>
  );
}
