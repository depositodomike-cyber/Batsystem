// Import Dependencies
import { ColumnDef } from "@tanstack/react-table";

// Local Imports
import {
  SelectCell,
  SelectHeader,
} from "@/components/shared/table/SelectCheckbox";
import { DateTimeCell, LocationCell, NameCell, StatusCell } from "./rows";
import { RowActions } from "./RowActions";
import { Appointment } from "./fakeData";

// ----------------------------------------------------------------------

export const columns: ColumnDef<Appointment>[] = [
  {
    id: "select",
    header: SelectHeader,
    cell: SelectCell,
  },
  {
    id: "name",
    accessorKey: "name",
    header: "name",
    cell: NameCell,
  },
  {
    id: "location",
    accessorKey: "location",
    header: "location",
    cell: LocationCell,
  },
  {
    id: "datetime",
    accessorKey: "datetime",
    header: "datetime",
    cell: DateTimeCell,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "status",
    cell: StatusCell,
  },
  {
    id: "actions",
    header: "",
    cell: RowActions,
  },
];
