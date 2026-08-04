import { ComponentPropsItem } from "@/components/docs/demo/DemoLayout/ComponentProps";

export const componentProps: ComponentPropsItem[] = [
  {
    componentName: "Breadcrumbs",
    desc: "A component for displaying navigation breadcrumbs.",
    props: [
      {
        name: "items",
        type: "array",
        description:
          "An array of breadcrumb items representing the navigation hierarchy.",
      },
    ],
  },
];
