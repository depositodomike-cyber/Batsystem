// Import Dependencies
import clsx from "clsx";
import { Column } from "@tanstack/react-table";

// Local Imports
import { Button } from "@/components/ui";
import { createScopedKeydownHandler } from "@/utils/dom/createScopedKeydownHandler";
import { type Role, User } from "./data";

// ----------------------------------------------------------------------

export function RoleFilter({
  column,
  options,
}: {
  column: Column<User>;
  options: Role[];
}) {
  const selectedValue = column?.getFilterValue() || "";

  return (
    <div
      data-tab
      className="text-xs-plus dark:bg-dark-700 dark:text-dark-200 flex rounded-md bg-gray-200 px-1 py-1 text-gray-800"
    >
      <Button
        data-tab-item
        onClick={() => column.setFilterValue("")}
        className={clsx(
          "shrink-0 rounded-sm px-2.5 py-1 font-medium whitespace-nowrap",
          selectedValue === ""
            ? "dark:bg-dark-500 dark:text-dark-100 bg-white shadow-sm"
            : "dark:hover:text-dark-100 dark:focus:text-dark-100 hover:text-gray-900 focus:text-gray-900",
        )}
        unstyled
        onKeyDown={createScopedKeydownHandler({
          siblingSelector: "[data-tab-item]",
          parentSelector: "[data-tab]",
          activateOnFocus: true,
          loop: false,
          orientation: "horizontal",
        })}
      >
        All
      </Button>
      {options.map((option) => (
        <Button
          key={option.value}
          data-tab-item
          onClick={() => column.setFilterValue(option.value)}
          className={clsx(
            "shrink-0 rounded-sm px-2.5 py-1 font-medium whitespace-nowrap",
            selectedValue === option.value
              ? "dark:bg-dark-500 dark:text-dark-100 bg-white shadow-sm"
              : "dark:hover:text-dark-100 dark:focus:text-dark-100 hover:text-gray-900 focus:text-gray-900",
          )}
          unstyled
          onKeyDown={createScopedKeydownHandler({
            siblingSelector: "[data-tab-item]",
            parentSelector: "[data-tab]",
            activateOnFocus: true,
            loop: false,
            orientation: "horizontal",
          })}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
