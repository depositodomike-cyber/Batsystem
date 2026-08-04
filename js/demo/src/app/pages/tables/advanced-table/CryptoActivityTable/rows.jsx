// Import Dependencies
import { UserIcon } from "@heroicons/react/20/solid";
import {
  ArrowsRightLeftIcon,
  BoltIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import dayjs from "dayjs";
import PropTypes from "prop-types";

// Local Imports
import { useLocaleContext } from "app/contexts/locale/context";
import { Avatar } from "components/ui";

// ----------------------------------------------------------------------

const activityColor = {
  "utility-payment": "info",
  "property-coverage": "primary",
  personal: "warning",
};

// Component map - declared outside of render
const activityIconMap = {
  "utility-payment": ShieldExclamationIcon,
  "property-coverage": BoltIcon,
  personal: UserIcon,
  default: ArrowsRightLeftIcon,
};

export function ActivityCell({ row, getValue }) {
  const activityType = row.original.activity_type.key;
  const Icon = activityIconMap[activityType] || activityIconMap.default;

  return (
    <div className="flex items-center space-x-4 ">
      <Avatar
        classNames={{ display: "rounded-lg" }}
        initialColor={activityColor[activityType]}
        size={9}
      >
        <Icon className="size-5" />
      </Avatar>

      <div>
        <p className="truncate font-medium text-gray-800 dark:text-dark-100">
          {getValue()}
        </p>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-dark-300">
          {row.original.activity_type.title}
        </p>
      </div>
    </div>
  );
}

export function AccountNameCell({ getValue }) {
  return (
    <span className="font-medium text-gray-800 dark:text-dark-100">
      {getValue()} Wallet
    </span>
  );
}

export function TransactionDateCell({ getValue }) {
  const { locale } = useLocaleContext();
  return (
    <span>
      {dayjs(getValue()).locale(locale).format("ddd, DD MMM - HH:mm")}
    </span>
  );
}

export function AmountCell({ row, getValue }) {
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

ActivityCell.propTypes = {
  row: PropTypes.object,
  getValue: PropTypes.func,
};

AccountNameCell.propTypes = {
  getValue: PropTypes.func,
};

TransactionDateCell.propTypes = {
  getValue: PropTypes.func,
};

AmountCell.propTypes = {
  row: PropTypes.object,
  getValue: PropTypes.func,
};
