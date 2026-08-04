import { ReturnItem } from "@/components/docs/demo/DemoLayout/Returns";

export const returns: ReturnItem[] = [
  {
    name: "result",
    type: "array",
    description: "An array containing the search results.",
  },
  {
    name: "query",
    type: "string",
    description: "The current search query string.",
  },
  {
    name: "setQuery",
    type: "function",
    description: "A function that allows updating the search query.",
  },
];
