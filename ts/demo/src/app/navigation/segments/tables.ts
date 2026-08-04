import { baseNavigationObj } from "../baseNavigation";
import { NavigationTree } from "@/@types/navigation";

const ROOT_TABLES = "/tables";

const path = (root: string, item: string) => `${root}${item}`;

export const tables: NavigationTree = {
  ...baseNavigationObj["tables"],
  type: "root",
  childs: [
    {
      id: "tables.orders-datatable-1",
      path: path(ROOT_TABLES, "/orders-datatable-1"),
      type: "item",
      title: "Orders Datatable 1",
      transKey: "nav.tables.orders-datatable-1",
      icon: "table.item",
    },
    {
      id: "tables.orders-datatable-2",
      path: path(ROOT_TABLES, "/orders-datatable-2"),
      type: "item",
      title: "Orders Datatable 2",
      transKey: "nav.tables.orders-datatable-2",
      icon: "table.item",
    },
    {
      id: "tables.courses-datatable",
      path: path(ROOT_TABLES, "/courses-datatable"),
      type: "item",
      title: "Courses Datatable",
      transKey: "nav.tables.courses-datatable",
      icon: "table.item",
    },
    {
      id: "tables.users-datatable",
      path: path(ROOT_TABLES, "/users-datatable"),
      type: "item",
      title: "Users Datatable",
      transKey: "nav.tables.users-datatable",
      icon: "table.item",
    },
    {
      id: "tables.projects-datatable",
      path: path(ROOT_TABLES, "/projects-datatable"),
      type: "item",
      title: "Projects Datatable",
      transKey: "nav.tables.projects-datatable",
      icon: "table.item",
    },
    {
      id: "tables.divide-1",
      type: "divider",
    },
    {
      id: "tables.basic-table",
      path: path(ROOT_TABLES, "/basic-table"),
      type: "item",
      title: "Basic Table",
      transKey: "nav.tables.basic-table",
      icon: "table.item",
    },
    {
      id: "tables.react-table",
      path: path(ROOT_TABLES, "/react-table"),
      type: "item",
      title: "React Table",
      transKey: "nav.tables.react-table",
      icon: "table.item",
    },
    {
      id: "tables.advanced-tables",
      path: path(ROOT_TABLES, "/advanced-tables"),
      type: "item",
      title: "Advanced Table",
      transKey: "nav.tables.advanced-tables",
      icon: "table.item",
    },
  ],
};
