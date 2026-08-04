import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { Basic } from "./Basic";
import { params } from "./params";

import { BreadcrumbItem } from "@/components/shared/Breadcrumbs";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "useUnmount" },
];

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "Custom hook that runs a cleanup function when the component is unmounted.",
    Component: Basic,
  },
];

export default function UseUnmount() {
  return (
    <DemoLayout
      title="useUnmount"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
    />
  );
}
