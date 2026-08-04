// Local Imports
import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { componentProps } from "./props";
import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Shared Components", path: "/docs/shared-components" },
  { title: "Breadcrumbs" },
];

const markdownPath = "docs/shared-components/BreadcrumbsExamples";

const demos: Demo[] = [
  {
    title: "Breadcrumbs",
    description:
      "Explore the custom breadcrumb component and view the code for detailed implementation and usage instructions.",
    Component: Basic,
    markdownName: "Basic",
  },
];

const BreadcrumbsExamples = () => {
  return (
    <DemoLayout
      title="Breadcrumbs"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      componentProps={componentProps}
    />
  );
};

export default BreadcrumbsExamples;
