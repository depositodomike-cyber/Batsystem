// Local Imports
import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Basic } from "./Basic";
import { CustomIcon } from "./CustomIcon";
import { WithInput } from "./WithInput";
import { componentProps } from "./props";

// ----------------------------------------------------------------------

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Components", path: "/components" },
  { title: "Contextual Help" },
];

const markdownPath = "components/contextual-help";

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "<code>ContextualHelp</code> help shows a user extra information about the state of an adjacent component, or a total view. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
  {
    title: "Custom Icon",
    description:
      "Custom <code>ContextualHelp</code> help icon. Check out code for detail of usage.",
    Component: CustomIcon,
    markdownName: "CustomIcon",
  },
  {
    title: "With Input",
    description:
      "Integrate the Input component with the <code>ContextualHelp</code> component. Check out code for detail of usage.",
    Component: WithInput,
    markdownName: "WithInput",
  },
];

export default function ContextualHelp() {
  return (
    <DemoLayout
      title="Contextual Help"
      breadcrumbs={breadcrumbs}
      markdownPath={markdownPath}
      demos={demos}
      componentProps={componentProps}
    />
  );
}
