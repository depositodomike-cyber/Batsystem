// Local Imports
import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Shared Components", path: "/docs/shared-components" },
  { title: "SyntaxHightlighter" },
];

const markdownPath = "docs/shared-components/SyntaxHightlighterExample";

const demos: Demo[] = [
  {
    title: "Syntax Hightlighter",
    description:
      "Syntax Hightlighter component for highlight code. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
];

const SyntaxHightlighterExample = () => {
  return (
    <DemoLayout
      title="SyntaxHightlighter"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
    />
  );
};

export default SyntaxHightlighterExample;
