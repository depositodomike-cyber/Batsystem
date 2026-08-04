import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "htmlToDelta" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Convert HTML to Quill Delta format.",
    Component: Usage,
  },
];

export default function HtmlToDelta() {
  return (
    <DemoLayout
      title="htmlToDelta"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
