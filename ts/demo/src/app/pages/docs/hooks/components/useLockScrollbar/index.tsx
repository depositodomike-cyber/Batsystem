import { Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { params } from "./params";
import { returns } from "./returns";

import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "useLockScrollbar" },
];

const markdownPath = "docs/hooks/useLockScrollbar";

const demos: Demo[] = [
  {
    title: "useLockScrollbar",
    description:
      "A custom hook that locks and unlocks scroll. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
];

export default function UseLockScrollbar() {
  return (
    <DemoLayout
      title="useLockScrollbar"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
