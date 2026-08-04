// Import Dependencies
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import {
  type BreadcrumbItem,
  Breadcrumbs,
} from "@/components/shared/Breadcrumbs";
import { Menu } from "./sections/Menu";
import { Content } from "./sections/Content";
import { Input } from "@/components/ui";

// ----------------------------------------------------------------------

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Pages", path: "/pages" },
  { title: "Help", path: "/pages/help" },
  { title: "Help v2" },
];

export default function Help2() {
  return (
    <Page title="Help v2">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <div className="flex items-center justify-between space-x-4 py-5 lg:py-6">
          <div className="flex items-center space-x-4">
            <h2 className="dark:text-dark-50 text-xl font-medium tracking-wide text-gray-800 lg:text-2xl">
              Help v2
            </h2>
            <div className="hidden self-stretch py-1 sm:flex">
              <div className="dark:bg-dark-600 h-full w-px bg-gray-300"></div>
            </div>
            <Breadcrumbs items={breadcrumbs} className="max-sm:hidden" />
          </div>
          <Input
            className="h-8 rounded-full"
            placeholder="Search here..."
            prefix={<MagnifyingGlassIcon className="size-4.5" />}
          />
        </div>

        <Menu />
        <Content />
      </div>
    </Page>
  );
}
