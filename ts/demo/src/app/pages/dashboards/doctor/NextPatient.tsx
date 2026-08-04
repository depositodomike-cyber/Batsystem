// Import Dependencies
import { Fragment } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

// Local Imports
import { Avatar, Box, Button } from "@/components/ui";

// ----------------------------------------------------------------------

export function NextPatient() {
  return (
    <Box className="bg-info/10 dark:bg-dark-800 rounded-lg px-4 pb-5">
      <div className="flex h-14 min-w-0 items-center justify-between py-3">
        <h2 className="text-sm-plus dark:text-dark-100 truncate font-medium tracking-wide text-gray-800">
          Next Patient
        </h2>
        <ActionMenu />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between">
          <Avatar size={16} src="/images/avatar/avatar-20.jpg" />
          <div>
            <p>Today</p>
            <p className="dark:text-dark-100 text-xl font-medium text-gray-800">
              11:00
            </p>
          </div>
        </div>
        <div>
          <h3 className="dark:text-dark-100 text-lg font-medium text-gray-800">
            Alfredo Elliott
          </h3>
          <p className="dark:text-dark-300 text-xs text-gray-400">Checkup</p>
        </div>
        <div className="text-xs-plus space-y-3">
          <div className="flex justify-between">
            <p className="dark:text-dark-100 font-medium text-gray-800">
              D.O.B.
            </p>
            <p className="text-right">25 Jan 1998</p>
          </div>
          <div className="flex justify-between">
            <p className="dark:text-dark-100 font-medium text-gray-800">
              Weight
            </p>
            <p className="text-right">56 kg</p>
          </div>
          <div className="flex justify-between">
            <p className="dark:text-dark-100 font-medium text-gray-800">
              Height
            </p>
            <p className="text-right">164 cm</p>
          </div>
          <div className="flex justify-between">
            <p className="dark:text-dark-100 font-medium text-gray-800">
              Last Appointment
            </p>
            <p className="text-right">25 May 2021</p>
          </div>
          <div className="flex justify-between">
            <p className="dark:text-dark-100 font-medium text-gray-800">
              Register Date
            </p>
            <p className="text-right">16 Jun 2020</p>
          </div>
        </div>
      </div>
    </Box>
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
