// Import Dependencies
import { type ColumnDef } from "@tanstack/react-table";

// Local Imports
import { CopyableCell } from "@/components/shared/table/CopyableCell";
import { NameCell, RoleCell, StatusCell } from "./rows";
import { RowActions } from "./RowActions";
import { HighlightableCell } from "@/components/shared/table/HighlightableCell";
import { type User } from "./data";

// ----------------------------------------------------------------------

export const columns: ColumnDef<User>[] = [
  {
    id: "status",
    accessorKey: "status",
    header: "Stat",
    label: "Status",
    cell: StatusCell,
  },
  {
    id: "name",
    accessorKey: "name",
    header: "name",
    label: "Name",
    cell: NameCell,
  },
  {
    id: "role",
    accessorKey: "role",
    header: "role",
    label: "Role",
    cell: RoleCell,
    filterFn: "equalsString",
  },
  {
    id: "age",
    accessorKey: "age",
    header: "age",
    label: "Age",
    cell: HighlightableCell,
  },
  {
    id: "phone",
    accessorKey: "phone",
    header: "phone",
    label: "Phone",
    cell: (props: any) => <CopyableCell {...props} highlight />,
  },
  {
    id: "email",
    accessorKey: "email",
    header: "email",
    label: "Email",
    cell: (props: any) => <CopyableCell {...props} highlight />,
  },
  {
    id: "actions",
    header: "",
    label: "Row Actions",
    cell: RowActions,
  },
];
