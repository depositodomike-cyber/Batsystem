// Import Dependencies
import {
  CurrencyDollarIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import { ClockIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Row, Getter } from "@tanstack/react-table";

// Local Imports
import { Badge } from "@/components/ui";
import { formatNumber } from "@/utils/formatNumber";
import { courseStatusOptions, levelOptions, type Course } from "./data";
import { msToTime } from "@/utils/msToTime";

// ----------------------------------------------------------------------

export function CourseNameCell({
  row,
  getValue,
}: {
  row: Row<Course>;
  getValue: Getter<any>;
}) {
  const duration = msToTime(row.original.duration);
  return (
    <div className="flex max-w-xs items-center space-x-4 2xl:max-w-sm">
      <div className="size-12 shrink-0">
        <img
          className="h-full w-full rounded-lg object-cover object-center"
          src={row.original.image}
          alt="destination"
          loading="lazy"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate">
          <a
            href="##"
            className="hover:text-primary-600 dark:text-dark-100 dark:hover:text-primary-400 font-medium text-gray-700 transition-colors"
          >
            {getValue()}
          </a>
        </p>
        <div className="mt-2 flex items-center space-x-2 text-xs">
          <div className="flex shrink-0 items-center space-x-1">
            <ClockIcon className="dark:text-dark-300 size-4 text-gray-400" />
            <p className="opacity-80">{duration}</p>
          </div>
          <div className="dark:bg-dark-500 mx-2 my-0.5 w-px self-stretch bg-gray-200"></div>
          <p>
            <span>{row.original.lesson_count}</span>
            <span className="opacity-80"> Lessons</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function EarningCell({
  row,
  getValue,
}: {
  row: Row<Course>;
  getValue: Getter<any>;
}) {
  return (
    <div className="flex space-x-2">
      <div
        data-tooltip
        data-tooltip-content="Earning"
        className="flex items-center space-x-0.5"
      >
        <CurrencyDollarIcon className="dark:text-dark-300 size-5 text-gray-400" />
        <p>{formatNumber(getValue())}</p>
      </div>
      <span>/</span>
      <div
        data-tooltip
        data-tooltip-content="Students"
        className="flex items-center space-x-1"
      >
        <UserGroupIcon className="dark:text-dark-300 size-5 text-gray-400" />
        <p>{formatNumber(row.original.students)}</p>
      </div>
    </div>
  );
}

export function LevelCell({ getValue }: { getValue: Getter<any> }) {
  const val = getValue();
  const option = levelOptions.find((item) => item.value === val);

  if (!option) return null;

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-end space-x-0.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            style={{ height: `${(i + 1) * 0.23 + 0.2}rem` }}
            className={clsx(
              "h-2 w-1 rounded-sm",
              i < option.index
                ? "bg-primary-500"
                : "dark:bg-dark-450 bg-gray-200",
            )}
          ></div>
        ))}
      </div>
      <p>{option.label}</p>
    </div>
  );
}

export function RatingCell({ getValue }: { getValue: Getter<any> }) {
  return (
    <div className="flex items-center space-x-1">
      <StarIcon className="size-4 text-yellow-500" />
      <span>{getValue()}</span>
    </div>
  );
}

export function StatusCell({ getValue }: { getValue: Getter<any> }) {
  const val = getValue();
  const option = courseStatusOptions.find((item) => item.value === val);

  return (
    <Badge color={option?.color} className="rounded-full" variant="outlined">
      {option?.label}
    </Badge>
  );
}

export function PriceCell({ getValue }: { getValue: Getter<any> }) {
  return <>${getValue()}</>;
}
