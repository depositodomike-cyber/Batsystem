// Import Dependencies
import { ColumnDef } from "@tanstack/react-table";

// Local Imports
import { RowActions } from "./RowActions";
import {
  SelectCell,
  SelectHeader,
} from "@/components/shared/table/SelectCheckbox";
import {
  CollaboratorsCell,
  PartnerCell,
  ProgressCell,
  ProjectNameCell,
  StartedDateCell,
  TagsCell,
} from "./rows";
import { Project } from "./data";

// ----------------------------------------------------------------------

export const columns: ColumnDef<Project>[] = [
  {
    id: "select",
    header: SelectHeader,
    label: "Row Select",
    cell: SelectCell,
  },
  {
    id: "partner_name",
    accessorKey: "partner_name",
    header: "Partner",
    label: "Partner Name",
    cell: PartnerCell,
  },
  {
    id: "project_name",
    accessorKey: "project_name",
    header: "Project Name",
    label: "Project Name",
    cell: ProjectNameCell,
  },
  {
    id: "collaborators",
    accessorKey: "collaborators",
    header: "Collaborators",
    label: "Collaborators",
    cell: CollaboratorsCell,
    filterFn: "arrIncludesSome",
  },
  {
    id: "tags",
    accessorKey: "tags",
    header: "Tags",
    label: "Tags",
    cell: TagsCell,
    filterFn: "arrIncludesSome",
  },
  {
    id: "progress",
    accessorKey: "progress",
    header: "progress",
    label: "Progress",
    cell: ProgressCell,
  },
  {
    id: "started_at",
    accessorKey: "started_at",
    header: "started date",
    label: "Started Date",
    cell: StartedDateCell,
    filterFn: "inNumberRange",
  },
  {
    id: "deadline",
    accessorKey: "deadline",
    isHiddenColumn: true,
    filterFn: "inNumberRange",
  },
  {
    id: "status",
    accessorKey: "status",
    isHiddenColumn: true,
  },
  {
    id: "actions",
    header: "",
    cell: RowActions,
  },
];
