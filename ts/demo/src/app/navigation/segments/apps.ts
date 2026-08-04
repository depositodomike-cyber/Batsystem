import { NavigationTree } from "@/@types/navigation";
import { baseNavigationObj } from "../baseNavigation";

const ROOT_APPS = "/apps";

const path = (root: string, item: string) => `${root}${item}`;

export const apps: NavigationTree = {
  ...baseNavigationObj["apps"],
  type: "root",
  childs: [
    {
      id: "apps.chat",
      path: path(ROOT_APPS, "/chat"),
      type: "item",
      title: "Chat",
      transKey: "nav.apps.chat",
      icon: "apps.chat",
    },
    {
      id: "apps.ai-chat",
      path: path(ROOT_APPS, "/ai-chat"),
      type: "item",
      title: "AI Chat",
      transKey: "nav.apps.ai-chat",
      icon: "apps.ai-chat",
    },
    {
      id: "apps.kanban",
      path: path(ROOT_APPS, "/kanban"),
      type: "item",
      title: "Kanban Board",
      transKey: "nav.apps.kanban",
      icon: "apps.kanban",
    },
    {
      id: "apps.mail",
      path: path(ROOT_APPS, "/mail"),
      type: "item",
      title: "Mail App",
      transKey: "nav.apps.mail",
      icon: "apps.mail",
    },
    {
      id: "apps.todo",
      path: path(ROOT_APPS, "/todo"),
      type: "item",
      title: "Todo",
      transKey: "nav.apps.todo",
      icon: "apps.todo",
    },
    {
      id: "apps.divide-1",
      type: "divider",
    },
    {
      id: "apps.nft-1",
      path: path(ROOT_APPS, "/nft-1"),
      type: "item",
      title: "NFT App v1",
      transKey: "nav.apps.nft-1",
      icon: "apps.nft-1",
    },
    {
      id: "apps.nft-2",
      path: path(ROOT_APPS, "/nft-2"),
      type: "item",
      title: "NFT App v2",
      transKey: "nav.apps.nft-2",
      icon: "apps.nft-2",
    },
    {
      id: "apps.filemanager",
      path: path(ROOT_APPS, "/filemanager"),
      type: "item",
      title: "File Manager",
      transKey: "nav.apps.filemanager",
      icon: "apps.filemanager",
    },
    {
      id: "apps.pos",
      path: path(ROOT_APPS, "/pos"),
      type: "item",
      title: "POS Sytem",
      transKey: "nav.apps.pos",
      icon: "apps.pos",
    },
    {
      id: "apps.travel",
      path: path(ROOT_APPS, "/travel"),
      type: "item",
      title: "Travel",
      transKey: "nav.apps.travel",
      icon: "apps.travel",
    },
  ],
};
