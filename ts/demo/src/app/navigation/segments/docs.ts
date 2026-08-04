import { NavigationTree } from "@/@types/navigation";
import { baseNavigationObj } from "../baseNavigation";

const ROOT_DOCS = "/docs";

const path = (root: string, item: string) => `${root}${item}`;

export const docs: NavigationTree = {
  ...baseNavigationObj["docs"],
  type: "root",
  childs: [
    {
      id: "docs.getting-started",
      path: path(ROOT_DOCS, "/getting-started"),
      type: "item",
      title: "Getting Started",
      transKey: "nav.docs.getting-started",
      icon: "docs.getting-started",
    },
    {
      id: "docs.shared-components",
      path: path(ROOT_DOCS, "/shared-components"),
      type: "item",
      title: "Shared Components",
      transKey: "nav.docs.shared-components",
      icon: "docs.shared-components",
    },
    {
      id: "docs.hooks",
      path: path(ROOT_DOCS, "/hooks"),
      type: "item",
      title: "Hooks",
      transKey: "nav.docs.hooks",
      icon: "docs.hooks",
    },
    {
      id: "docs.utils",
      path: path(ROOT_DOCS, "/utils"),
      type: "item",
      title: "Utils",
      transKey: "nav.docs.utils",
      icon: "docs.utils",
    },
    {
      id: "docs-dividers",
      type: "divider",
    },
    {
      id: "docs.attributions",
      path: path(ROOT_DOCS, "/attributions"),
      type: "item",
      title: "Attributions",
      transKey: "nav.docs.attributions",
      icon: "docs.attributions",
    },
    {
      id: "docs.changelogs",
      path: path(ROOT_DOCS, "/changelogs"),
      type: "item",
      title: "Changelogs",
      transKey: "nav.docs.changelogs",
      icon: "docs.changelogs",
    },
  ],
};
