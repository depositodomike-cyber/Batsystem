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
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

// Local Imports
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------

const chartConfig: ApexOptions = {
  colors: ["#a855f7"],

  chart: {
    parentHeightOffset: 0,

    toolbar: {
      show: false,
    },
    dropShadow: {
      enabled: true,
      color: "#1E202C",
      top: 18,
      left: 6,
      blur: 8,
      opacity: 0.1,
    },
  },
  stroke: {
    width: 5,
    curve: "smooth",
  },
  xaxis: {
    type: "datetime",
    categories: [
      "1/11/2000",
      "2/11/2000",
      "3/11/2000",
      "4/11/2000",
      "5/11/2000",
      "6/11/2000",
      "7/11/2000",
    ],
    tickAmount: 10,
    labels: {
      formatter: function (_value, timestamp, opts) {
        const fmt = (
          opts as { dateFormatter?: (d: Date, f: string) => string } | undefined
        )?.dateFormatter;
        if (timestamp && fmt) return fmt(new Date(timestamp), "dd MMM");
        return "";
      },
    },
  },
  yaxis: {
    labels: {
      offsetX: -12,
      offsetY: 0,
    },
  },
  fill: {
    type: "gradient",
    gradient: {
      shade: "dark",
      gradientToColors: ["#86efac"],
      shadeIntensity: 1,
      type: "horizontal",
      opacityFrom: 1,
      opacityTo: 0.95,
      stops: [0, 100, 0, 100],
    },
  },
  grid: {
    padding: {
      left: 0,
      right: 0,
    },
  },
};

const series = [
  {
    name: "Sales",
    data: [200, 100, 300, 200, 400, 300, 500],
  },
];

export function Activity() {
  return (
    <div>
      <div className="flex h-8 min-w-0 items-center justify-between">
        <h2 className="dark:text-dark-100 truncate font-medium tracking-wide text-gray-800">
          Activity
        </h2>
        <ActionMenu />
      </div>
      <Chart options={chartConfig} series={series} type="line" height="270" />
    </div>
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
