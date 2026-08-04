import { ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "text",
    type: "string",
    description: "The text in which the highlight operation will be performed.",
  },
  {
    name: "query",
    type: "string",
    description: "The substring to be highlighted within the text.",
  },
];
