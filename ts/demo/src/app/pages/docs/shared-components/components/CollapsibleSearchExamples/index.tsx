import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Basic } from "./Basic";
import { componentProps } from "./props";
import { CustomButton } from "./CustomButton";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Shared Components", path: "/docs/shared-components" },
  { title: "CollapsibleSearch" },
];

const markdownPath = "docs/shared-components/CollapsibleSearchExamples";

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "A basic implementation of the CollapsibleSearch component, showcasing its core functionality. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
  {
    title: "Custom Button",
    description:
      "An example demonstrating how to customize the button within the CollapsibleSearch component. Check out code for detail of usage.",
    Component: CustomButton,
    markdownName: "CustomButton",
  },
];

export default function CollapsibleSearchExamples() {
  return (
    <DemoLayout
      title="Collapsible Search"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      componentProps={componentProps}
    />
  );
}
