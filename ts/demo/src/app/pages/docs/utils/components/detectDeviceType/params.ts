import { type ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "navigator",
    type: "Navigator",
    default: "window.navigator",
    description: "Optional navigator object from the browser.",
  },
];
