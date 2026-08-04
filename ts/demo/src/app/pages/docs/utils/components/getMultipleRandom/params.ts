import { ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "arr",
    type: "array",
    description: "The array to pick random elements from.",
  },
  {
    name: "num",
    type: "number",
    description: "The number of random elements to return.",
  },
];
