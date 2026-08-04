import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "getUserAgentBrowser" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Detects the user's browser type from the user agent string.",
    Component: Usage,
    markdownName: "Usage",
  },
];

export default function GetUserAgentBrowser() {
  return (
    <DemoLayout
      title="getUserAgentBrowser"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      returns={returns}
      params={params}
    />
  );
}
