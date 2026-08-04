import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "ensureString" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description:
      "Ensures the input is a string. If the input is <code>null</code> or <code>undefined</code>, returns an empty string.",
    Component: Usage,
  },
];

export default function EnsureString() {
  return (
    <DemoLayout
      title="ensureString"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
