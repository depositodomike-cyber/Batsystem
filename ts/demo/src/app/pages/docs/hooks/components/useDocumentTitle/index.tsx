import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { params } from "./params";

import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "useDocumentTitle" },
];

const markdownPath = "docs/hooks/useDocumentTitle";

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "<code>useDocumentTitle</code> sets document.title property with <code>useLayoutEffect</code> hook. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
];

export default function UseDocumentTitle() {
  return (
    <DemoLayout
      title="useDocumentTitle"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      params={params}
    />
  );
}

