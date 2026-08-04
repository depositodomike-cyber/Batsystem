import { ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "list",
    type: "array",
    description: "An array of items to be searched.",
  },
  {
    name: "options",
    type: "object",
    description:
      "A configuration object containing options for the fuse.js search instance.",
  },
];
