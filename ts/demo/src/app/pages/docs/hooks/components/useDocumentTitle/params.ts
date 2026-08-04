import { ParamItem } from "@/components/docs/demo/DemoLayout/Params";

export const params: ParamItem[] = [
  {
    name: "title",
    type: "string",
    description: "The document title to be set.",
  },
  {
    name: "options",
    type: "object",
    description: "Configuration options for the hook.",
    default: "{}",
  },
  {
    name: "options.preserveTitleOnUnmount",
    type: "boolean",
    description:
      "Determines if the document title should be retained when the component unmounts.",
    default: "true",
  },
];
