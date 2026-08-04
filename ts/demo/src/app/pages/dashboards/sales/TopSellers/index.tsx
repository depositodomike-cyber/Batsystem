// Import Dependencies
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Fragment } from "react";
import { register } from "swiper/element/bundle";

// Local Imports
import { Button, Card } from "@/components/ui";
import { SellerCard, type Seller } from "./SellerCard";
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------

register();

const sellers: Seller[] = [
  {
    id: "1",
    avatar: "/images/avatar/avatar-20.jpg",
    name: "Travis Fuller",
    sales: "2 348",
    impression: 4.3,
    chartData: [20, 420, 102, 540, 275, 614],
  },
  {
    id: "2",
    avatar: "/images/avatar/avatar-5.jpg",
    name: "Konnor Guzman",
    sales: "6 052",
    impression: -2.33,
    chartData: [54, 77, 43, 69, 12],
  },
  {
    id: "3",
    avatar: "/images/avatar/avatar-11.jpg",
    name: "Katrina West",
    sales: "2 348",
    impression: 2.62,
    chartData: [0, 20, 10, 30, 20, 50],
  },
  {
    id: "4",
    avatar: undefined,
    name: "Henry Curtis",
    sales: "4 574",
    impression: 1.2,
    chartData: [654, 820, 102, 540, 154, 614],
  },
];

export function TopSellers() {
  const { direction } = useLocaleContext();

  return (
    <Card className="pb-4">
      <div className="flex min-w-0 items-center justify-between px-4 py-3">
        <h2 className="dark:text-dark-100 min-w-0 font-medium tracking-wide text-gray-800">
          Top Sellers
        </h2>
        <ActionMenu />
      </div>
      {/* @ts-expect-error - Swiper web components */}
      <swiper-container
        pagination
        pagination-clickable
        slides-per-view="1"
        dir={direction}
        space-between="16"
      >
        {sellers.map((seller) => (
          <Fragment key={seller.id}>
            {/* @ts-expect-error - Swiper web components */}
            <swiper-slide>
              <SellerCard {...seller} />
              {/* @ts-expect-error - Swiper web components */}
            </swiper-slide>
          </Fragment>
        ))}
        {/* @ts-expect-error - Swiper web components */}
      </swiper-container>
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
