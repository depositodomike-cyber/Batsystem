// Local Imports
import { BreadcrumbItem, Breadcrumbs } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Shared Components", path: "/docs/shared-components" },
  { title: "Breadcrumbs" },
];

export const Basic = () => {
  return (
    <div>
      <Breadcrumbs items={breadcrumbs} />
    </div>
  );
};
