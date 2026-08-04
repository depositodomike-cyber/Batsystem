import { ComponentPropsItem } from "@/components/docs/demo/DemoLayout/ComponentProps";

export const componentProps: ComponentPropsItem[] = [
  {
    componentName: "ContextualHelp",
    desc: "A component providing inline contextual help with an icon, title, and content.",
    props: [
      {
        name: "Icon",
        type: "React.ElementType",
        default: "QuestionMarkCircleIcon",
        description: "The icon to display for triggering the contextual help.",
      },
      {
        name: "title",
        type: "string | React.ReactNode",
        description: "The title or heading of the contextual help content.",
      },
      {
        name: "content",
        type: "string | React.ReactNode",
        description: "The main content or description of the contextual help.",
      },
      {
        name: "anchor",
        type: "PopoverPanelProps['anchor']",
        default: "{ to: 'bottom start', gap: 8 }",
        description: `Defines the position and spacing of the contextual help popup. 
                - to: Specifies the popup position relative to the icon (e.g., 'bottom start', 'top end').
                - gap: The spacing between the icon and the popup, in pixels.`,
      },
    ],
  },
];
