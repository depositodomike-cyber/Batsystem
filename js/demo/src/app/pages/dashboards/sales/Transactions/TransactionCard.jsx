// Import Dependencies
import { PropTypes } from "prop-types";
import clsx from "clsx";

// Local Imports
import { Avatar, Card } from "components/ui";

// ----------------------------------------------------------------------

export function TransactionCard({ name, avatar, time, amount }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size={10} src={avatar} name={name} initialColor="auto" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-gray-800 dark:text-dark-100">
            {name}
          </span>
          <span className="truncate text-xs text-gray-400 dark:text-dark-300">
            {time}
          </span>
        </div>
      </div>
      <span
        className={clsx(
          `this:${amount > 0 ? "success" : "error"}`,
          "text-sm font-medium text-this dark:text-this-lighter",
        )}
      >
        ${Math.abs(amount).toFixed(2)}
      </span>
    </Card>
  );
}

TransactionCard.propTypes = {
  name: PropTypes.string,
  avatar: PropTypes.string,
  time: PropTypes.string,
  amount: PropTypes.number,
};
