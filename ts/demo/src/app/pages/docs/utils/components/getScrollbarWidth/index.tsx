import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "getScrollbarWidth" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Get the width of the browser's scrollbar in pixels.",
    Component: Usage,
    markdownName: "Usage",
  },
];

export default function GetScrollbarWidth() {
  return (
    <DemoLayout
      title="getScrollbarWidth"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      returns={returns}
    />
  );
}
