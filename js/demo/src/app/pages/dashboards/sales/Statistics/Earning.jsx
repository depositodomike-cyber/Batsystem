// Import Dependencies
import Chart from "react-apexcharts";

// Local Imports
import { Card } from "components/ui";

// ----------------------------------------------------------------------

const series = [
  {
    name: "Earning A",
    data: [44, 55, 41, 25, 22],
  },
  {
    name: "Earning 0",
    data: [13, 23, 20, 60, 13],
  },
];

const chartConfig = {
  grid: {
    show: false,
    padding: {
      left: -8,
      right: 0,
      bottom: -8,
      top: 0,
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
  xaxis: {
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
  chart: {
    toolbar: {
      show: false,
    },
    stacked: true,
    stackType: "100%",
  },
  dataLabels: {
    enabled: false,
  },
  fill: {
    colors: ["#0EA5E9", "#e2e8f0"],
  },
  plotOptions: {
    bar: {
      borderRadius: 2,
      horizontal: false,
      columnWidth: "25%",
    },
  },
  legend: {
    show: false,
  },
};

export function Earning() {
  return (
    <Card className="row-span-2 flex flex-col px-4 sm:px-5">
      <h2 className="min-w-0 pt-3 font-medium tracking-wide text-gray-800 dark:text-dark-100">
        Earning
      </h2>
      <p className="grow mt-1 text-xl font-semibold text-gray-800 dark:text-dark-100">
        $16.4k
      </p>
      <div>
        <Chart type="bar" height={120} options={chartConfig} series={series} />
      </div>
    </Card>
  );
}
