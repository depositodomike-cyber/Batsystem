import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "isServer" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Detects if code is running on the server.",
    Component: Usage,
    markdownName: "Usage",
  },
];

export default function IsServer() {
  return (
    <DemoLayout
      title="isServer"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      returns={returns}
    />
  );
}
