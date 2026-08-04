import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "isRouteActive" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Determines if a route is active based on the current path.",
    Component: Usage,
  },
];

export default function IsRouteActive() {
  return (
    <DemoLayout
      title="isRouteActive"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
