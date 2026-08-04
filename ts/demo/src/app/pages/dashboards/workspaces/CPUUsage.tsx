// Import Dependencies
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

// Local Imports
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

const chartOptions: ApexOptions = {
  colors: ["#0EA5E9"],
  chart: {
    sparkline: {
      enabled: true,
    },
  },
  plotOptions: {
    radialBar: {
      startAngle: -90,
      endAngle: 90,

      dataLabels: {
        name: {
          show: false,
        },
        value: {
          offsetY: -2,
          fontSize: "18px",
        },
      },
    },
  },
  responsive: [
    {
      breakpoint: 400,
      options: {
        chart: {
          height: "160px",
        },
      },
    },
  ],
  grid: {
    padding: {
      top: 0,
      right: -10,
      bottom: 0,
      left: -10,
    },
  },
  labels: ["Average Results"],
};

export function CPUUsage() {
  return (
    <Card className="card row-span-2 justify-between px-2 py-5 text-center">
      <p className="dark:text-dark-100 font-medium tracking-wide text-gray-800">
        CPU Usage
      </p>
      <div className="ax-transparent-gridline pr-1">
        <Chart
          height="200"
          type="radialBar"
          series={[76]}
          options={chartOptions}
        />
      </div>
      <p className="text-xs-plus mt-4">
        Daily usage is{" "}
        <span className="dark:text-dark-100 font-medium text-gray-800">
          Good
        </span>
      </p>
    </Card>
  );
}
