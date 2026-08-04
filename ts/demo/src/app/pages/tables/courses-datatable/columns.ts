// Import Dependencies
import { ColumnDef } from "@tanstack/react-table";

// Local Imports
import {
  SelectCell,
  SelectHeader,
} from "@/components/shared/table/SelectCheckbox";
import { RowActions } from "./RowActions";
import {
  CourseNameCell,
  EarningCell,
  LevelCell,
  PriceCell,
  RatingCell,
  StatusCell,
} from "./rows";
import { Course } from "./data";

// ----------------------------------------------------------------------

export const columns: ColumnDef<Course>[] = [
  {
    id: "select",
    label: "Row Selection",
    header: SelectHeader,
    cell: SelectCell,
  },
  {
    id: "name",
    accessorKey: "name",
    header: "Course",
    label: "Course",
    cell: CourseNameCell,
  },
  {
    id: "category",
    accessorKey: "category",
    header: "Category",
    label: "Category",
  },
  {
    id: "level",
    accessorKey: "level",
    header: "Level",
    label: "Level",
    cell: LevelCell,
    filterColumn: "searchableSelect",
    filterFn: "arrIncludesSome",
  },
  {
    id: "rating",
    accessorKey: "rating",
    header: "Rating",
    label: "Rating",
    cell: RatingCell,
    filterFn: "inNumberRange",
    filterColumn: "numberRange",
  },
  {
    id: "price",
    accessorKey: "price",
    header: "Price",
    label: "Price",
    cell: PriceCell,
    filterFn: "inNumberRange",
    filterColumn: "numberRange",
  },
  {
    id: "earning",
    accessorKey: "earning",
    header: "Earning",
    label: "Earning",
    cell: EarningCell,
    filterFn: "inNumberRange",
    filterColumn: "numberRange",
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    label: "Status",
    cell: StatusCell,
    filterColumn: "searchableSelect",
    filterFn: "arrIncludesSome",
  },
  {
    id: "actions",
    header: "",
    label: "Row Actions",
    cell: RowActions,
  },
  {
    id: "lesson_count",
    accessorKey: "lesson_count",
    isHiddenColumn: true,
    filterFn: "inNumberRange",
    filterColumn: "numberRange",
  },
  {
    id: "students",
    accessorKey: "students",
    isHiddenColumn: true,
    filterFn: "inNumberRange",
    filterColumn: "numberRange",
  },
  {
    id: "duration",
    accessorKey: "duration",
    isHiddenColumn: true,
    filterFn: "inNumberRange",
    filterColumn: "numberRange",
  },
];
