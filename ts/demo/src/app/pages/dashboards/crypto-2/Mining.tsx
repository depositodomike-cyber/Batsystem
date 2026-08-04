// Import Dependencies
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Fragment } from "react";

// Local Imports
import { Avatar, Button, Card, Switch } from "@/components/ui";

// ----------------------------------------------------------------------

export function Mining() {
  return (
    <Card className="px-4 pb-4 sm:px-5">
      <div className="flex min-w-0 items-center justify-between py-3">
        <h2 className="dark:text-dark-100 truncate font-medium tracking-wide text-gray-800">
          Mining Stats
        </h2>
        <ActionMenu />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="dark:border-dark-600 flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Avatar
              size={10}
              classNames={{ display: "rounded-lg" }}
              initialColor="success"
            >
              <CpuChipIcon className="size-6" />
            </Avatar>
            <div>
              <p className="dark:text-dark-100 font-medium text-gray-800">
                ID: 5988745
              </p>
              <p className="text-success dark:text-success-lighter mt-0.5 truncate text-xs">
                Up for 2 hours
              </p>
            </div>
          </div>
          <Switch defaultChecked className="rounded-lg before:rounded-md" />
        </div>

        <div className="dark:border-dark-600 flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Avatar
              size={10}
              classNames={{ display: "rounded-lg" }}
              initialColor="success"
            >
              <CpuChipIcon className="size-6" />
            </Avatar>
            <div>
              <p className="dark:text-dark-100 font-medium text-gray-800">
                ID: 5488615
              </p>
              <p className="text-success dark:text-success-lighter mt-0.5 truncate text-xs">
                Up for 4 hours
              </p>
            </div>
          </div>
          <Switch defaultChecked className="rounded-lg before:rounded-md" />
        </div>

        <div className="dark:border-dark-600 flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Avatar
              size={10}
              classNames={{ display: "rounded-lg" }}
              initialColor="warning"
            >
              <CpuChipIcon className="size-6" />
            </Avatar>
            <div>
              <p className="dark:text-dark-100 font-medium text-gray-800">
                ID: 3591458
              </p>
              <p className="text-warning dark:text-warning-lighter mt-0.5 truncate text-xs">
                Down for 31 minutes
              </p>
            </div>
          </div>
          <Switch className="rounded-lg before:rounded-md" />
        </div>

        <div className="dark:border-dark-600 flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Avatar size={10} classNames={{ display: "rounded-lg" }}>
              <CpuChipIcon className="size-6" />
            </Avatar>
            <div>
              <p className="dark:text-dark-100 font-medium text-gray-800">
                ID: 6517997
              </p>
              <p className="mt-0.5 truncate text-xs">Power Off</p>
            </div>
          </div>
          <Switch className="rounded-lg before:rounded-md" />
        </div>
      </div>
    </Card>
  );
}

function ActionMenu() {
  return (
    <Menu
      as="div"
      className="relative inline-block text-left ltr:-mr-1.5 rtl:-ml-1.5"
    >
      <MenuButton
        as={Button}
        variant="flat"
        isIcon
        className="size-8 rounded-full"
      >
        <EllipsisHorizontalIcon className="size-5" />
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out"
        enterFrom="opacity-0 translate-y-2"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-2"
      >
        <MenuItems className="dark:border-dark-500 dark:bg-dark-700 absolute z-100 mt-1.5 min-w-[10rem] rounded-lg border border-gray-300 bg-white py-1 shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden ltr:right-0 rtl:left-0 dark:shadow-none">
          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <span>Action</span>
              </button>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <span>Another action</span>
              </button>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <span>Other action</span>
              </button>
            )}
          </MenuItem>

          <hr className="border-gray-150 dark:border-dark-500 mx-3 my-1.5 h-px" />

          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <span>Separated action</span>
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Transition>
    </Menu>
  );
}
