import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "formatBytes" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description:
      "Converts a number of bytes into a human-readable format (e.g., KB, MB, GB).",
    Component: Usage,
  },
];

export default function FormatBytes() {
  return (
    <DemoLayout
      title="formatBytes"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
