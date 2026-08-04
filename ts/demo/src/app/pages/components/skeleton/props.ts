import { ComponentPropsItem } from "@/components/docs/demo/DemoLayout/ComponentProps";

export const componentProps: ComponentPropsItem[] = [
  {
    componentName: "Skeleton",
    desc: "A placeholder component for content loading, supporting animation for better visual feedback.",
    props: [
      {
        name: "animate",
        type: "boolean",
        default: true,
        description:
          "If true, applies a shimmering animation to indicate loading.",
      },
      {
        name: "className",
        type: "string",
        description:
          "Additional CSS class names to apply to the skeleton component for customization.",
      },
    ],
  },
];
