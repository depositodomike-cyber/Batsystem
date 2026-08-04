import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "isRef" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Checks if a value is a Vue ref or reactive object.",
    Component: Usage,
  },
];

export default function IsRef() {
  return (
    <DemoLayout
      title="isRef"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
