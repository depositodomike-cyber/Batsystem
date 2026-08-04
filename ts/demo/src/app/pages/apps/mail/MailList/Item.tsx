// Import Dependencies
import clsx from "clsx";
import dayjs from "dayjs";
import { StarIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { Link } from "react-router";

// Local Imports
import { Avatar, Badge, Button, Checkbox } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { Mail } from "../data";

// ----------------------------------------------------------------------

export function Item({ data }: { data: Mail }) {
  const { id, date, title, body, isImportant, isUnread, labels, sender } = data;
  const { locale } = useLocaleContext();

  return (
    <div
      className={clsx(
        isUnread
          ? "dark:text-dark-50 font-bold text-gray-800"
          : "dark:text-dark-200 text-gray-600",
        "dark:border-dark-500 flex flex-col border-b p-2.5 font-semibold last:border-b-0 sm:flex-row sm:items-center",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2 sm:w-72">
          <div className="flex">
            <div className="flex size-8 items-center justify-center">
              <Checkbox />
            </div>
            <div className="flex max-sm:hidden">
              <Button isIcon variant="flat" className="size-8 rounded-full">
                {isImportant ? (
                  <StarIconSolid className="text-primary-600 dark:text-primary-400 size-5" />
                ) : (
                  <StarIcon className="size-5" />
                )}
              </Button>
              <Button isIcon variant="flat" className="size-8 rounded-full">
                <EllipsisHorizontalIcon className="size-5" />
              </Button>
            </div>
          </div>
          <Link
            to={"/apps/mail/" + id}
            className="flex min-w-0 items-center gap-2"
          >
            <Avatar
              size={6}
              src={sender.avatar}
              name={sender.name}
              initialColor="auto"
              classNames={{ display: "text-tiny-plus" }}
            />
            <h3 className="truncate">{sender.name}</h3>
            {labels.map((label) => (
              <span
                key={label.id}
                className={clsx(
                  "bg-this h-2 w-2 shrink-0 rounded-full lg:hidden",
                  `this:${label.color}`,
                )}
              />
            ))}
          </Link>
        </div>
        <div className="shrink-0 px-1 text-xs sm:hidden">
          {dayjs(date).locale(locale).format("MMM D")}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <Link
          to={"/apps/mail/" + id}
          className="flex min-w-0 items-center gap-2 px-2"
        >
          <span className="truncate">
            <span>{title}</span>{" "}
            <span className="dark:text-dark-200 font-normal text-gray-600">
              {body}
            </span>
          </span>
          {labels.map((label) => (
            <Badge
              key={label.id}
              color={label.color}
              className="rounded-full max-lg:hidden"
              variant="outlined"
            >
              {label.text}
            </Badge>
          ))}
        </Link>
        <div className="flex sm:hidden">
          <Button isIcon variant="flat" className="size-8 rounded-full">
            {isImportant ? (
              <StarIconSolid className="text-primary-600 dark:text-primary-400 size-5" />
            ) : (
              <StarIcon className="size-5" />
            )}
          </Button>
          <Button isIcon variant="flat" className="size-8 rounded-full">
            <EllipsisHorizontalIcon className="size-5" />
          </Button>
        </div>
      </div>
      <div className="text-xs-plus hidden px-2 sm:flex">
        {dayjs(date).locale(locale).format("MMM D")}
      </div>
    </div>
  );
}
