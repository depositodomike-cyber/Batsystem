// Import Dependencies
import {
  Dispatch,
  SetStateAction,
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  Cog8ToothIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { RiFilter3Line } from "react-icons/ri";
import clsx from "clsx";

// Local Imports
import { Button, Input } from "@/components/ui";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";

// ----------------------------------------------------------------------

type ToolbarProps = {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
};

export function Toolbar({ query, setQuery }: ToolbarProps) {
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const { isXs } = useBreakpointsContext();

  useEffect(() => {
    if (showMobileSearch) setTimeout(() => mobileSearchRef?.current?.focus());
  }, [showMobileSearch]);

  return (
    <div className="flex items-center justify-between py-5 lg:py-6">
      {showMobileSearch && isXs ? (
        <Input
          classNames={{
            root: "flex-1",
            input: "text-xs-plus h-9",
          }}
          value={query || ""}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Users ..."
          ref={mobileSearchRef}
          prefix={<MagnifyingGlassIcon className="size-4.5" />}
          suffix={
            <Button
              variant="flat"
              className="pointer-events-auto size-6 shrink-0 rounded-full p-0"
              onClick={() => {
                setQuery("");
                setShowMobileSearch(false);
              }}
            >
              <XMarkIcon className="dark:text-dark-200 size-4.5 text-gray-500" />
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center space-x-1">
            <h2 className="dark:text-dark-50 truncate text-xl font-medium text-gray-700 lg:text-2xl">
              User Card
            </h2>
            <ActionMenu />
          </div>
          <div className="flex items-center space-x-1">
            <Input
              classNames={{
                input: "text-xs-plus h-9 rounded-full",
                root: "max-sm:hidden",
              }}
              value={query || ""}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Users ..."
              className=""
              prefix={<MagnifyingGlassIcon className="size-4.5" />}
            />
            <Button
              onClick={() => setShowMobileSearch(true)}
              className="size-9 shrink-0 rounded-full sm:hidden"
              isIcon
              variant="flat"
            >
              <MagnifyingGlassIcon className="size-5" />
            </Button>

            <Button
              className="size-9 shrink-0 rounded-full"
              isIcon
              variant="flat"
            >
              <RiFilter3Line className="size-5" />
            </Button>
            <Button
              className="size-9 shrink-0 rounded-full"
              isIcon
              variant="flat"
            >
              <Cog8ToothIcon className="size-5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ActionMenu() {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton
        as={Button}
        variant="flat"
        className="size-8 shrink-0 rounded-full p-0"
      >
        <ChevronDownIcon className="size-4.5" strokeWidth="2" />
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
        <MenuItems className="dark:border-dark-500 dark:bg-dark-700 absolute z-100 mt-1.5 min-w-[10rem] rounded-lg border border-gray-300 bg-white py-1 whitespace-nowrap shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden ltr:right-0 rtl:left-0 dark:shadow-none">
          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center space-x-2 px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <PlusIcon className="size-4.5 stroke-2" />
                <span>New User</span>
              </button>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center space-x-2 px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <ArrowDownTrayIcon className="size-4.5 stroke-2" />
                <span>Export Users</span>
              </button>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                className={clsx(
                  "flex h-9 w-full items-center space-x-2 px-3 tracking-wide outline-hidden transition-colors",
                  focus &&
                    "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                )}
              >
                <Cog8ToothIcon className="size-4.5 stroke-2" />
                <span>Settings</span>
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Transition>
    </Menu>
  );
}
