import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { returns } from "./returns";
import { params } from "./params";
import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "useClipboard" },
];

const markdownPath = "docs/hooks/useClipboard";

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "The hook for copy to clipboard. Also you can use <code>CopyButton</code> component. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
];

export default function UseClipboard() {
  return (
    <DemoLayout
      title="useClipboard"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      returns={returns}
      params={params}
    />
  );
}
