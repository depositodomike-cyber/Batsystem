import { type ComponentPropsItem } from "@/components/docs/demo/DemoLayout/ComponentProps";

export const componentProps: ComponentPropsItem[] = [
  {
    componentName: "Delayed",
    desc: "A component that delays rendering its child content for a specified time period.",
    props: [
      {
        name: "wait",
        type: "number",
        description:
          "The delay duration in milliseconds before rendering the child component.",
      },
    ],
  },
];
