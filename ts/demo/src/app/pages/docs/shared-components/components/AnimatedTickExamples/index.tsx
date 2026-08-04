// Local Imports
import { type Demo, DemoLayout } from "@/components/docs/demo/DemoLayout";
import { type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { Basic } from "./Basic";
import { WithoutAnimation } from "./WithoutAnimation";
import { StrokeWidth } from "./StrokeWidth";
import { componentProps } from "./props";

const breadcrumbs: BreadcrumbItem[] = [
  { title: "Docs", path: "/docs" },
  { title: "Shared Components", path: "/docs/shared-components" },
  { title: "AnimatedTick" },
];

const markdownPath = "docs/shared-components/AnimatedTickExamples";

const demos: Demo[] = [
  {
    title: "Basic",
    description:
      "Demonstrates the tick with a smooth initial animation. Toggle the button to display or hide the tick. Check out code for detail of usage.",
    Component: Basic,
    markdownName: "Basic",
  },
  {
    title: "Without Animation",
    description:
      "Shows the tick without any animation. Use the toggle button to display or hide the tick. Check out code for detail of usage.",
    Component: WithoutAnimation,
    markdownName: "WithoutAnimation",
  },
  {
    title: "Stroke Width",
    description:
      "You can customize the tick size and stroke width. Check out code for detail of usage.",
    Component: StrokeWidth,
    markdownName: "StrokeWidth",
  },
];

const AnimatedTickExamples = () => {
  return (
    <DemoLayout
      title="AnimatedTick"
      breadcrumbs={breadcrumbs}
      demos={demos}
      markdownPath={markdownPath}
      hasPadding={false}
      componentProps={componentProps}
    />
  );
};

export default AnimatedTickExamples;
