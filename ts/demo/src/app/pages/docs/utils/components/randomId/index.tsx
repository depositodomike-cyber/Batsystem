import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "randomId" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Generates a random identifier string.",
    Component: Usage,
    markdownName: "Usage",
  },
];

export default function RandomId() {
  return (
    <DemoLayout
      title="randomId"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      returns={returns}
    />
  );
}
