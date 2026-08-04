// Import Dependencies
import { EnvelopeIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/20/solid";
import { FaTwitter } from "react-icons/fa";

// Local Imports
import { Badge } from "@/components/ui";
import { colorFromText } from "@/utils/colorFromText";
import { Row } from "@tanstack/react-table";
import { type User } from "./fakeData";

// ----------------------------------------------------------------------

export function SubRowComponent({
  row,
  cardWidth,
}: {
  row: Row<User>;
  cardWidth?: number;
}) {
  return (
    <div
      className="dark:border-b-dark-500 dark:bg-dark-750 sticky border-b border-b-gray-200 bg-gray-50 pt-3 pb-4 ltr:left-0 rtl:right-0"
      style={{ maxWidth: cardWidth }}
    >
      <div className="grid grid-cols-1 gap-5 px-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
        <div>
          <p className="font-medium">Stack:</p>
          <div className="mt-3 flex max-w-xs flex-wrap gap-2">
            {row.original.stack.map((item, i) => (
              <Badge
                key={i}
                className="capitalize"
                color={colorFromText(item)}
                variant="soft"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium">Office:</p>
          <div className="mt-3 flex items-center space-x-1">
            <MapPinIcon className="dark:text-dark-300 size-4.5 text-gray-400" />
            <span>{row.original.office}</span>
          </div>
        </div>
        <div>
          <p className="font-medium">Info:</p>
          <div className="mt-3 space-y-2">
            {row.original.info.phone && (
              <a
                href={"tel:" + row.original.info.phone}
                className="group flex items-center gap-2"
              >
                <PhoneIcon className="dark:text-dark-300 size-4 text-gray-400" />
                <span className="group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {row.original.info.phone}
                </span>
              </a>
            )}
            {row.original.email && (
              <a
                href={"mailto:" + row.original.email}
                className="group flex items-center gap-2"
              >
                <EnvelopeIcon className="dark:text-dark-300 size-4 text-gray-400" />
                <span className="group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {row.original.email}
                </span>
              </a>
            )}
            {row.original.info.twitter && (
              <a
                href={"https://twitter.com/" + row.original.info.twitter}
                className="group flex items-center gap-2"
              >
                <FaTwitter className="dark:text-dark-300 size-4 text-gray-400" />
                <span className="group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {row.original.info.twitter}
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
