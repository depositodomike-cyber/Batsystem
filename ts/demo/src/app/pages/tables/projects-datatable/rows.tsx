// Import Dependencies
import dayjs from "dayjs";
import { Getter, Row } from "@tanstack/react-table";

// Local Imports
import { Avatar, Badge, Circlebar } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { colorFromText } from "@/utils/colorFromText";
import { collaborators, Project } from "./data";
import { ColorType } from "@/constants/app";

// ----------------------------------------------------------------------

function getColorProgress(val: number): ColorType {
  if (val === 0) return "neutral";
  if (val === 100) return "success";
  if (val < 10) return "warning";
  if (val < 50) return "info";
  return "primary";
}

export function PartnerCell({
  row,
  getValue,
}: {
  row: Row<Project>;
  getValue: Getter<any>;
}) {
  const val = getValue();
  return (
    <div className="flex items-center gap-3">
      <div className="size-9">
        <img
          src={row.original.partner_image}
          alt={val}
          className="h-full w-full"
        />
      </div>
      <p className="dark:text-dark-100 font-medium text-gray-800">{val}</p>
    </div>
  );
}

export function CollaboratorsCell({ row }: { row: Row<Project> }) {
  const collabs = collaborators.filter((collab) =>
    row.original.collaborators.includes(collab.uid),
  );

  return (
    <div className="flex -space-x-2">
      {collabs.map((item, i) => (
        <Avatar
          key={i}
          data-tooltip
          data-tooltip-content={item.name}
          size={8}
          name={item.name}
          src={item.avatar}
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

export function ProjectNameCell({
  row,
  getValue,
}: {
  row: Row<Project>;
  getValue: Getter<any>;
}) {
  return (
    <div className="line-clamp-2 w-72 whitespace-normal">
      <span className="dark:text-dark-100 font-semibold text-gray-800">
        {getValue()}:{" "}
      </span>{" "}
      <span title={row.original.project_desc}>{row.original.project_desc}</span>
    </div>
  );
}

export function TagsCell({ row }: { row: Row<Project> }) {
  return (
    <div className="flex w-64 flex-wrap gap-2">
      {row.original.tags.map((item, i) => (
        <Badge
          key={i}
          className="rounded-full border border-white/10 capitalize"
          color={colorFromText(item)}
          variant="soft"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function StartedDateCell({
  getValue,
  row,
}: {
  getValue: Getter<any>;
  row: Row<Project>;
}) {
  const { locale } = useLocaleContext();

  return (
    <div>
      <p>{dayjs(getValue()).locale(locale).format("DD MMM YYYY")}</p>
      <p className="mt-1 text-xs">
        <span className="dark:text-error-lighter font-semibold text-gray-700">
          Deadline:
        </span>{" "}
        {dayjs(row.original.deadline).locale(locale).format("DD MMM YYYY")}
      </p>
    </div>
  );
}

export function ProgressCell({ getValue }: { getValue: Getter<any> }) {
  const val = getValue();

  return (
    <Circlebar
      size={13}
      strokeWidth={9}
      value={val}
      color={getColorProgress(val)}
    >
      <div className="text-tiny-plus dark:text-dark-100 font-semibold text-gray-800">
        {val}%
      </div>
    </Circlebar>
  );
}
