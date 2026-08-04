import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "msToTime" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Converts milliseconds to a formatted time string.",
    Component: Usage,
    markdownName: "Usage",
  },
];

export default function MsToTime() {
  return (
    <DemoLayout
      title="msToTime"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
