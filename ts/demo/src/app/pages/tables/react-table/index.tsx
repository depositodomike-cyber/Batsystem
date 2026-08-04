// Local Imports
import { Page } from "@/components/shared/Page";
import {
  type BreadcrumbItem,
  Breadcrumbs,
} from "@/components/shared/Breadcrumbs";
import { Basic } from "./Basic";
import { ColumnSizing } from "./ColumnSizing";
import { ColumnVisibility } from "./ColumnVisibility";
import { Expanding } from "./Expanding";
import { RowSelection } from "./RowSelection";
import { Search } from "./Search";
import { Sorting } from "./Sorting";
import { PaginationExample } from "./PaginationExample";
import { EditableRow } from "./EditableRow";
import { SubComponent } from "./SubComponent";

// ----------------------------------------------------------------------

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Tables", path: "/tables" },
  { title: "React Table" },
];

export default function ReactTable() {
  return (
    <Page title="React Table">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <div className="flex items-center space-x-4 py-5 lg:py-6">
          <h2 className="dark:text-dark-50 text-xl font-medium tracking-wide text-gray-800 lg:text-2xl">
            React Table
          </h2>
          <div className="hidden self-stretch py-1 sm:flex">
            <div className="dark:bg-dark-600 h-full w-px bg-gray-300"></div>
          </div>
          <Breadcrumbs items={breadcrumbs} className="max-sm:hidden" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6">
          <Basic />
          <Sorting />
          <ColumnVisibility />
          <ColumnSizing />
          <RowSelection />
          <Search />
          <PaginationExample />
          <EditableRow />
          <Expanding />
          <SubComponent />
        </div>
      </div>
    </Page>
  );
}
