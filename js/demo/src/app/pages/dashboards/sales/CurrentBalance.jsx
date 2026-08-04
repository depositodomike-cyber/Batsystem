// Import Dependencies
import Chart from "react-apexcharts";
import { ArrowDownCircleIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Box, Button } from "components/ui";

// ----------------------------------------------------------------------

const series = [
  {
    name: "Earning",
    data: [0, 20, 50, 10],
  },
];

const chartConfig = {
  colors: ["#fff"],
  chart: {
    stacked: false,
    parentHeightOffset: 0,
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  grid: {
    padding: {
      left: 0,
      right: 0,
      top: -28,
    },
  },
  stroke: {
    width: 3,
    curve: "smooth",
  },
  tooltip: {
    shared: true,
  },
  legend: {
    show: false,
  },
  yaxis: {
    show: false,
  },
  xaxis: {
    labels: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
    axisBorder: {
      show: false,
    },
  },
};

export function CurrentBalance() {
  return (
    <Box className="relative flex flex-col rounded-lg bg-linear-to-br from-primary-600 to-primary-500 px-5 pb-5">
      <div className="ax-transparent-gridline mt-5 w-1/2">
        <Chart type="line" height="70" series={series} options={chartConfig} />
      </div>
      <p className="mt-8 text-3xl font-semibold">
        <span className="text-white/80">$</span>
        <span className="text-white">31.313</span>
      </p>
      <p className="font-medium tracking-wide text-white/80">Current Balance</p>
      <div className="mt-5">
        <Button
          unstyled
          className="w-full gap-2 rounded-full border border-white/30 px-5 py-2 text-white hover:bg-white/30 focus:bg-white/30 active:bg-white/25"
        >
          <ArrowDownCircleIcon className="size-4.5 shrink-0" />
          <span>Get Statement</span>
        </Button>
      </div>
    </Box>
  );
}
