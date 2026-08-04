// Import Dependencies
import { useState } from "react";
import { toast } from "sonner";
import { Getter, Row, Table, Column } from "@tanstack/react-table";

// Local Imports
import { Avatar, Badge } from "@/components/ui";
import { StyledSwitch } from "@/components/shared/form/StyledSwitch";
import { User } from "./fakeData";
import { ColorType } from "@/constants/app";

// ----------------------------------------------------------------------

type Roles = "admin" | "superadmin" | "user" | "author" | "moderator";

const roleColors: Record<Roles, ColorType> = {
  admin: "info",
  superadmin: "error",
  user: "neutral",
  author: "success",
  moderator: "warning",
};

export function AvatarCell({ row }: { row: Row<User> }) {
  return (
    <Avatar
      size={10}
      name={row.original.name}
      src={row.original.avatar}
      initialColor="auto"
      classNames={{
        initial: "text-sm",
      }}
    />
  );
}

export function NameCell({ getValue }: { getValue: Getter<any> }) {
  return (
    <div className="dark:text-dark-100 font-medium text-gray-800">
      {getValue()}
    </div>
  );
}

export function RoleCell({ getValue }: { getValue: Getter<any> }) {
  const val = getValue() as Roles;
  return (
    <Badge color={roleColors[val]} variant="outlined" className="capitalize">
      {val}
    </Badge>
  );
}

export function StatusCell({
  getValue,
  row: { index },
  column: { id },
  table,
}: {
  getValue: Getter<any>;
  row: Row<User>;
  column: Column<User>;
  table: Table<User>;
}) {
  const val = getValue();
  const [loading, setLoading] = useState(false);

  const onChange = async (checked: boolean) => {
    setLoading(true);
    setTimeout(() => {
      table.options.meta?.updateData?.(index, id, checked);
      toast.success("User status updated");
      setLoading(false);
    }, 1000);
  };

  return <StyledSwitch checked={val} onChange={onChange} loading={loading} />;
}
