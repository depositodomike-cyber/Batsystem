// Import Dependencies
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

// Local Imports
import { Box } from "@/components/ui";
import { Wallet } from ".";

// ----------------------------------------------------------------------

const chartConfig: ApexOptions = {
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
      top: -28,
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

export function WalletCard({
  wallet,
  abbr,
  image,
  impession,
  amount,
  color,
  chartData,
}: Wallet) {
  return (
    <Box className="flex w-72 shrink-0 flex-col">
      <div className="flex items-center gap-2">
        <img src={image} alt={wallet} className="size-6" />
        <div>
          <span>{wallet}</span>{" "}
          <span className="dark:text-dark-300 text-xs text-gray-400 uppercase">
            {abbr}
          </span>
        </div>
      </div>
      <div className="dark:bg-surface-3 mt-2.5 flex justify-between rounded-lg bg-gray-50 py-3 ltr:pr-3 rtl:pl-3">
        <div className="ax-transparent-gridline">
          <Chart
            options={{
              ...chartConfig,
              colors: [color],
            }}
            series={[
              {
                name: "Stat",
                data: chartData,
              },
            ]}
            height="60"
            width="120"
            type="line"
          />
        </div>
        <div className="dark:bg-surface-2 flex w-36 flex-col items-center rounded-lg bg-gray-100 py-2">
          <p className="dark:text-dark-100 truncate text-xl font-medium text-gray-800">
            {amount}
          </p>
          <div
            className={clsx(
              `this:${impession > 0 ? "success" : "error"}`,
              "text-this dark:text-this-lighter mt-1 flex items-center gap-0.5 text-xs",
            )}
          >
            {impession > 0 ? (
              <ArrowUpIcon className="size-3.5" />
            ) : (
              <ArrowDownIcon className="size-3.5" />
            )}
            <span>{Math.abs(impession).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </Box>
  );
}
