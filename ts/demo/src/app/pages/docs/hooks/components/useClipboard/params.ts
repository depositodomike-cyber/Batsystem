import { ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "timeout",
    type: "number",
    default: "2000",
    description:
      "The duration (in milliseconds) before the copied state resets.",
  },
];
