import { ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "currentPath",
    type: "string",
    description: "The current pathname from the router.",
  },
  {
    name: "path",
    type: "string",
    description: "The path to compare against.",
  },
];
