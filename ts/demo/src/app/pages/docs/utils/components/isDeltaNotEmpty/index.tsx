import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "isDeltaNotEmpty" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description:
      "Checks if a Quill Delta object contains any non-whitespace content.",
    Component: Usage,
  },
];

export default function IsDeltaNotEmpty() {
  return (
    <DemoLayout
      title="isDeltaNotEmpty"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
