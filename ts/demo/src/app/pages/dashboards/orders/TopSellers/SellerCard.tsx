// Import Dependencies
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  EnvelopeIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

// Local Imports
import { Avatar, Box, Button } from "@/components/ui";
import { Seller } from ".";

// ----------------------------------------------------------------------

const chartConfig: ApexOptions = {
  colors: ["#4467EF"],
  chart: {
    parentHeightOffset: 0,
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: "smooth",
    width: 3,
  },

  grid: {
    padding: {
      left: 0,
      right: 0,
      top: -10,
      bottom: 0,
    },
  },
  xaxis: {
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
    labels: {
      show: false,
    },
  },
  yaxis: {
    show: false,
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
    labels: {
      show: false,
    },
  },
};

export function SellerCard({
  avatar,
  name,
  sales,
  impression,
  chartData,
}: Seller) {
  return (
    <Box className="dark:bg-surface-3 w-56 shrink-0 rounded-xl bg-gray-50 p-4">
      <div className="flex flex-col items-center space-y-3 text-center">
        <Avatar
          size={16}
          classNames={{
            root: "rounded-full bg-linear-to-r from-sky-400 to-blue-600 p-0.5",
            display: "dark:border-dark-700 border-2 border-white text-lg",
          }}
          name={name}
          src={avatar}
          initialColor="auto"
        />

        <div>
          <p className="dark:text-dark-100 text-base font-medium text-gray-800">
            {name}
          </p>
          <p className="text-xs-plus dark:text-dark-300 text-gray-400">
            Saleswoman
          </p>
        </div>
      </div>
      <div className="mt-5">
        <div>
          <p>Sales</p>
          <div className="mt-0.5 flex gap-2">
            <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
              {sales}
            </p>
            <p
              className={clsx(
                `this:${impression > 0 ? "success" : "error"}`,
                "this:success text-this dark:text-this-lighter flex items-center space-x-0.5 text-xs",
              )}
            >
              {impression > 0 ? (
                <ArrowUpIcon className="size-4" />
              ) : (
                <ArrowDownIcon className="size-4" />
              )}
              <span>{Math.abs(impression).toFixed(2)}%</span>
            </p>
          </div>
          <div className="ax-transparent-gridline">
            <Chart
              type="line"
              height="100"
              options={chartConfig}
              series={[
                {
                  name: "Income",
                  data: chartData,
                },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-center gap-2">
        <Button
          color="primary"
          variant="soft"
          isIcon
          className="size-8 rounded-full"
        >
          <ChatBubbleOvalLeftEllipsisIcon className="size-4" />
        </Button>
        <Button
          color="primary"
          variant="soft"
          isIcon
          className="size-8 rounded-full"
        >
          <EnvelopeIcon className="size-4" />
        </Button>
        <Button
          color="primary"
          variant="soft"
          isIcon
          className="size-8 rounded-full"
        >
          <PhoneIcon className="size-4" />
        </Button>
      </div>
    </Box>
  );
}
