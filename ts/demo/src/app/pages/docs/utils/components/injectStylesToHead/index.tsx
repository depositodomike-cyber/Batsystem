import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "injectStylesToHead" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Dynamically inject CSS into the document head.",
    Component: Usage,
    markdownName: "Usage",
  },
];

export default function InjectStylesToHead() {
  return (
    <DemoLayout
      title="injectStylesToHead"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
    />
  );
} 