import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "compareArrays" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Compares two arrays deeply to check if they are identical.",
    Component: Usage,
  },
];

export default function CompareArrays() {
  return (
    <DemoLayout
      title="compareArrays"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
