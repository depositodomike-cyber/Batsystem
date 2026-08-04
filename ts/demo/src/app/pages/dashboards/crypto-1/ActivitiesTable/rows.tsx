// Import Dependencies
import { UserIcon } from "@heroicons/react/20/solid";
import {
  ArrowsRightLeftIcon,
  BoltIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import dayjs from "dayjs";
import { Getter, Row } from "@tanstack/react-table";

// Local Imports
import { useLocaleContext } from "@/app/contexts/locale/context";
import { Avatar } from "@/components/ui";
import { ColorType } from "@/constants/app";
import { CryptoActivity } from "./fakeData";

// ----------------------------------------------------------------------

type ActivityType = "utility-payment" | "property-coverage" | "personal";

const activityColor: Record<ActivityType, ColorType> = {
  "utility-payment": "info",
  "property-coverage": "primary",
  personal: "warning",
};

const activityIcons = {
  "utility-payment": ShieldExclamationIcon,
  "property-coverage": BoltIcon,
  personal: UserIcon,
  default: ArrowsRightLeftIcon,
};

export function ActivityCell({
  row,
  getValue,
}: {
  row: Row<CryptoActivity>;
  getValue: Getter<any>;
}) {
  const Icon =
    activityIcons[row.original.activity_type.key as ActivityType] ||
    activityIcons.default;

  return (
    <div className="flex items-center space-x-4">
      <Avatar
        classNames={{ display: "rounded-lg" }}
        initialColor={
          activityColor[row.original.activity_type.key as ActivityType]
        }
        size={9}
      >
        <Icon className="size-5" />
      </Avatar>

      <div>
        <p className="dark:text-dark-100 truncate font-medium text-gray-800">
          {getValue()}
        </p>
        <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
          {row.original.activity_type.title}
        </p>
      </div>
    </div>
  );
}

export function AccountNameCell({ getValue }: { getValue: Getter<any> }) {
  return (
    <span className="dark:text-dark-100 font-medium text-gray-800">
      {getValue()} Wallet
    </span>
  );
}

export function TransactionDateCell({ getValue }: { getValue: Getter<any> }) {
  const { locale } = useLocaleContext();
  return (
    <span>
      {dayjs(getValue()).locale(locale).format("ddd, DD MMM - HH:mm")}
    </span>
  );
}

export function AmountCell({
  row,
  getValue,
}: {
  row: Row<CryptoActivity>;
  getValue: Getter<any>;
}) {
  const val = getValue();

  return (
    <span
      className={clsx(
        "font-semibold",
        val > 0
          ? "text-success dark:text-success-light"
          : "text-error dark:text-error-light",
      )}
    >
      {val} {row.original.account_name}
    </span>
  );
}
