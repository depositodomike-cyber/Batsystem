// Import Dependencies
import dayjs from "dayjs";
import { FolderIcon } from "@heroicons/react/20/solid";
import { Getter, Row } from "@tanstack/react-table";

// Local Imports
import { useLocaleContext } from "@/app/contexts/locale/context";
import { Avatar } from "@/components/ui";
import { formatBytes } from "@/utils/formatByte";
import { Folder as FolderType } from "./fakeData";

export function Name({ getValue }: { getValue: Getter<any> }) {
  return (
    <div className="flex items-center gap-4">
      <FolderIcon className="text-warning dark:text-warning-light size-8" />
      <span className="dark:text-dark-100 truncate font-medium text-gray-800">
        {getValue()}
      </span>
    </div>
  );
}

export function LastEdit({ getValue }: { getValue: Getter<any> }) {
  const { locale } = useLocaleContext();
  return dayjs(getValue()).locale(locale).format("DD MMM YYYY");
}

export function Size({ getValue }: { getValue: Getter<any> }) {
  return (
    <span className="dark:text-dark-100 font-medium text-gray-800">
      {formatBytes(getValue())}
    </span>
  );
}

export function Members({ row }: { row: Row<FolderType> }) {
  return (
    <div className="flex -space-x-2">
      {row.original.members.map((item) => (
        <Avatar
          key={item.uid}
          data-tooltip
          data-tooltip-content={item.name}
          size={8}
          name={item.name}
          src={item.image}
          initialColor="auto"
          classNames={{
            root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
            display: "dark:ring-dark-700 text-xs ring-3 ring-white",
          }}
        />
      ))}
    </div>
  );
}
