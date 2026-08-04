import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { IsTokenValid } from "./IsTokenValid";
import { SetSession } from "./SetSession";
import { returns } from "./returns";
import { params } from "./params";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Hooks", path: "/docs/hooks" },
  { title: "jwt" },
];

const demos: Demo[] = [
  {
    title: "Set session",
    description: "Sets a session token in localStorage",
    Component: SetSession,
  },
  {
    title: "Is token valid",
    description: "Checks if a token is valid",
    Component: IsTokenValid,
  },
];

export default function JWT() {
  return (
    <DemoLayout
      title="JWT"
      breadcrumbs={breadcrumbs}
      demos={demos}
      hasPadding={false}
      params={params}
      returns={returns}
    />
  );
}
