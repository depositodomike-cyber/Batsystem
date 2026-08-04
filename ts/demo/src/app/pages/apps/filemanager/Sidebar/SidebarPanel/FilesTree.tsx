// Import Dependencies
import clsx from "clsx";
import { useState } from "react";
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/20/solid";
import {
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { HiFolder } from "react-icons/hi";

// Local Imports
import { Button, Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { randomId } from "@/utils/randomId";

// ----------------------------------------------------------------------

interface TreeNode {
  id: string;
  isRoot?: boolean;
  title: string;
  children?: TreeNode[];
}

const tree: TreeNode[] = [
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

export function FilesTree() {
  const [isOpen, { toggle }] = useDisclosure(true);

  return (
    <div>
      <div className="flex min-w-0 items-center justify-between px-4 pt-4">
        <span className="text-tiny-plus truncate font-medium uppercase">
          My Files
        </span>
        <div className="flex ltr:-mr-1.5 rtl:-ml-1.5">
          <Button variant="flat" isIcon className="size-6 rounded-full">
            <MagnifyingGlassIcon className="size-3.5 stroke-2" />
          </Button>
          <Button
            onClick={toggle}
            variant="flat"
            isIcon
            className="size-6 rounded-full"
          >
            <ChevronUpIcon
              className={clsx(
                "size-3.5 stroke-2 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>
      <Collapse in={isOpen}>
        <Tree tree={tree} />
      </Collapse>
    </div>
  );
}

function Tree({ tree }: { tree: TreeNode[] }) {
  const [show, setshow] = useState<Record<string, boolean>>({});
  const { isRtl } = useLocaleContext();

  const toggle = (name: string) => {
    setshow((prevShow) => ({ ...prevShow, [name]: !prevShow[name] }));
  };

  const Icon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <div className="space-y-1 pt-1">
      {tree.map((parent: TreeNode) => (
        <div
          key={parent.id}
          className={clsx(
            "px-2 font-medium",
            !parent.isRoot && "ltr:pl-4 rtl:pr-4",
          )}
        >
          <button
            onClick={() => parent.children && toggle(parent.id)}
            className={clsx(
              "text-xs-plus dark:hover:bg-dark-600 dark:hover:text-dark-100 dark:focus:bg-dark-600 dark:focus:text-dark-100 flex w-full cursor-pointer items-center rounded-sm px-1 py-1 font-medium tracking-wide outline-hidden transition-all hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100 focus:text-gray-800",
              show[parent.id] && "dark:text-dark-100 text-gray-800",
            )}
          >
            {parent.children ? (
              <>
                <Icon
                  className={clsx(
                    "size-5 shrink-0 transition-transform ltr:mr-1 rtl:ml-1",
                    show[parent.id] && "rotate-90 rtl:-rotate-90",
                  )}
                />
              </>
            ) : (
              <div className="w-5 shrink-0 ltr:mr-1 rtl:ml-1" />
            )}
            <HiFolder className="text-warning dark:text-warning-light size-6 shrink-0 ltr:mr-3 rtl:ml-3" />
            <span className="truncate"> {parent.title}</span>
          </button>
          <Collapse in={!!show[parent.id]}>
            {parent.children && <Tree tree={parent.children} />}
          </Collapse>
        </div>
      ))}
    </div>
  );
}
