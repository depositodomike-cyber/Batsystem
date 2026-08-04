// Import Dependencies
import { ColumnDef } from "@tanstack/react-table";

// Local Imports
import { RowActions } from "./RowActions";
import {
  SelectCell,
  SelectHeader,
} from "@/components/shared/table/SelectCheckbox";
import {
  AddressCell,
  CustomerCell,
  DateCell,
  OrderIdCell,
  OrderStatusCell,
  ProfitCell,
  TotalCell,
} from "./rows";
import { Order, orderStatusOptions } from "./data";

// ----------------------------------------------------------------------

export const columns: ColumnDef<Order>[] = [
  {
    id: "select",
    label: "Row Selection",
    header: SelectHeader,
    cell: SelectCell,
  },
  {
    id: "order_id",
    accessorKey: "order_id",
    label: "Order ID",
    header: "Order",
    cell: OrderIdCell,
  },
  {
    id: "created_at",
    accessorKey: "created_at",
    label: "Order Date",
    header: "Date",
    cell: DateCell,
    filterColumn: "dateRange",
    filterFn: "inNumberRange",
  },
  {
    id: "customer",
    accessorFn: (row) => row.customer.name,
    label: "Customer",
    header: "Customer",
    cell: CustomerCell,
  },
  {
    id: "total",
    accessorKey: "total",
    label: "Total",
    header: "Total",
    filterColumn: "numberRange",
    filterFn: "inNumberRange",
    cell: TotalCell,
  },
  {
    id: "profit",
    accessorKey: "profit",
    label: "Profit",
    header: "Profit",
    cell: ProfitCell,
    filterColumn: "numberRange",
    filterFn: "inNumberRange",
  },
  {
    id: "order_status",
    accessorKey: "order_status",
    label: "Order Status",
    header: "Order Status",
    cell: OrderStatusCell,
    filterColumn: "select",
    filterFn: "arrIncludesSome",
    options: orderStatusOptions,
  },

  {
    id: "address",
    accessorFn: (row) =>
      `${row.shipping_address?.street}, ${row.shipping_address?.line}`,
    label: "Address",
    header: "Address",
    cell: AddressCell,
  },
  { id: "actions", label: "Row Actions", header: "Actions", cell: RowActions },
];
