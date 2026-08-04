// Import Dependencies
import {
  DocumentTextIcon,
  FilmIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Row, Getter } from "@tanstack/react-table";

// Local Imports
import { Avatar } from "@/components/ui";
import { ColorType } from "@/constants/app";
import { formatBytes } from "@/utils/formatByte";
import { Media } from "./fakeData";

// ----------------------------------------------------------------------

type FileExt = "mp3" | "mp4" | "pdf" | "ppt";

const fileColor: Record<FileExt, ColorType> = {
  mp3: "secondary",
  mp4: "warning",
  pdf: "info",
  ppt: "success",
};

const mediaIcons = {
  mp3: MusicalNoteIcon,
  mp4: FilmIcon,
  default: DocumentTextIcon,
};

const permissionColor = {
  view: "text-gray-800 dark:text-dark-100",
  "can-edit": "this:success text-this dark:text-this-lighter",
};

export function CourseNameCell({
  row,
  getValue,
}: {
  row: Row<Media>;
  getValue: Getter<string>;
}) {
  const fileExt = row.original.file_name.split(".").pop() as FileExt;
  const Icon = mediaIcons[fileExt as keyof typeof mediaIcons] || mediaIcons.default;

  return (
    <div className="flex w-64 items-center space-x-4 whitespace-normal">
      <Avatar
        size={9}
        initialColor={fileColor[fileExt]}
        classNames={{
          display: "rounded-lg",
        }}
      >
        <Icon className="size-5" />
      </Avatar>
      <span className="dark:text-dark-100 line-clamp-2 text-gray-800">
        {getValue()}
      </span>
    </div>
  );
}

export function FileNameCell({ getValue }: { getValue: Getter<string> }) {
  return (
    <div className="max-w-xs truncate">
      <a href="##" className="hover:underline focus:underline">
        {getValue()}
      </a>
    </div>
  );
}

export function PermissionCell({
  row,
  getValue,
}: {
  row: Row<Media>;
  getValue: Getter<string>;
}) {
  return (
    <div
      className={clsx(
        "inline-flex items-center space-x-2 leading-none",
        permissionColor[
          row.original.permission.key as keyof typeof permissionColor
        ],
      )}
    >
      <span className="size-2 rounded-full bg-current"></span>
      <span className="text-xs font-medium">{getValue()}</span>
    </div>
  );
}

export function AssignCell({ getValue }: { getValue: Getter<number> }) {
  return <span>{getValue()} Members</span>;
}

export function SizeCell({ getValue }: { getValue: Getter<number> }) {
  return (
    <span className="dark:text-dark-100 font-medium text-gray-800">
      {formatBytes(getValue())}
    </span>
  );
}
