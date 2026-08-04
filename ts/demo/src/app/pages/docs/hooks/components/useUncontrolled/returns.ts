import { ReturnItem } from "@/components/docs/demo/DemoLayout/Returns";

export const returns: ReturnItem[] = [
  {
    name: "value",
    type: "any",
    description: "The current state value.",
  },
  {
    name: "onChange",
    type: "function",
    description: "Function to update the state value.",
  },
  {
    name: "indicateIsControlled",
    type: "boolean",
    description: "Indicates whether the input is controlled or uncontrolled.",
  },
];
