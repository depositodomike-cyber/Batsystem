import { Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { returns } from "./returns";
import { params } from "./params";

import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "useId" },
];

const markdownPath = "docs/hooks/use-id";

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "<code>useId</code> hook generates a random id that persists across renders.",
    Component: Basic,
  },
];

export default function UseId() {
  return (
    <DemoLayout
      title="useId"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      returns={returns}
      params={params}
    />
  );
}
