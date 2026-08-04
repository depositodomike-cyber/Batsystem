import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Usage } from "./Usage";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "setThisClass" },
];

const demos: Demo[] = [
  {
    title: "Usage",
    description: "Returns the class name for the specified color. <code>(primary, secondary, info, success, warning, error)</code>",
    Component: Usage,
  },
];

export default function SetThisClass() {
  return (
    <DemoLayout
      title="setThisClass"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
} 