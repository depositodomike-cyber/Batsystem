// Import Dependencies
import clsx from "clsx";
import React, { useState } from "react";
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/20/solid";
import { HiFolder } from "react-icons/hi";

// Local Imports
import { randomId } from "@/utils/randomId";
import { Collapse } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------

// TypeScript Interfaces
interface TreeItem {
  id: string;
  isRoot?: boolean;
  title: string;
  children?: TreeItem[];
}

interface TreeShowState {
  [key: string]: boolean;
}

const tree: TreeItem[] = [
  {
    id: randomId(),
    isRoot: true,
    title: "Design",
    children: [
      { id: randomId(), title: "Web Apps" },
      {
        id: randomId(),
        title: "CRM Apps",
        children: [
          { id: randomId(), title: "LMS App" },
          { id: randomId(), title: "Ecommerce" },
          { id: randomId(), title: "Dashboards" },
        ],
      },
      { id: randomId(), title: "Desktop Apps" },
      { id: randomId(), title: "Mobile Apps" },
    ],
  },
  {
    id: randomId(),
    isRoot: true,
    title: "Backup Files",
  },
  {
    id: randomId(),
    isRoot: true,
    title: "Documents",
    children: [
      { id: randomId(), title: "Sheets" },
      { id: randomId(), title: "Slides" },
      { id: randomId(), title: "Words" },
    ],
  },
  {
    id: randomId(),
    isRoot: true,
    title: "Applications",
    children: [
      { id: randomId(), title: "Web Apps" },
      {
        id: randomId(),
        title: "CRM Apps",
        children: [
          { id: randomId(), title: "LMS App" },
          { id: randomId(), title: "Ecommerce" },
          { id: randomId(), title: "Dashboards" },
        ],
      },
      { id: randomId(), title: "Desktop Apps" },
      { id: randomId(), title: "Mobile Apps" },
    ],
  },
  {
    id: randomId(),
    isRoot: true,
    title: "Archives",
  },
];

function Tree({ tree }: { tree: TreeItem[] }): React.ReactElement {
  const [show, setshow] = useState<TreeShowState>({});
  const { isRtl } = useLocaleContext();

  const toggle = (name: string): void => {
    setshow({ ...show, [name]: !show[name] });
  };

  const Icon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <>
      {tree.map((parent) => (
        <div
          key={parent.id}
          className={clsx(!parent.isRoot && "ltr:pl-4 rtl:pr-4")}
        >
          <button
            onClick={() => toggle(parent.id)}
            className={clsx(
              "flex w-full cursor-pointer items-center rounded-sm px-2 py-1 font-medium tracking-wide outline-hidden transition-all hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100 focus:text-gray-800 dark:hover:bg-dark-600 dark:hover:text-dark-100 dark:focus:bg-dark-600 dark:focus:text-dark-100 rtl:space-x-reverse",
              show[parent.id] && "text-gray-800 dark:text-dark-100",
            )}
          >
            {parent.children ? (
              <Icon
                className={clsx(
                  "size-5 transition-transform ltr:mr-1 rtl:ml-1",
                  show[parent.id] && "rotate-90 rtl:-rotate-90",
                )}
              />
            ) : (
              <div className="w-5 ltr:mr-1 rtl:ml-1" />
            )}
            <HiFolder className="size-6 text-warning dark:text-warning-light ltr:mr-3 rtl:ml-3" />
            <span> {parent.title}</span>
          </button>
          <Collapse in={show[parent.id]}>
            {parent.children && <Tree tree={parent.children} />}
          </Collapse>
        </div>
      ))}
    </>
  );
}

export function Advanced() {
  return (
    <div className="max-w-xs">
      <Tree tree={tree} />
    </div>
  );
}
