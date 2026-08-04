import { ColorType } from "@/constants/app";
import { ApexOptions } from "apexcharts";

const colors: Record<ColorType, string> = {
  neutral: "#6366f1",
  primary: "#6366f1",
  secondary: "#F000B9",
  info: "#00BCD4",
  success: "#10B981",
  warning: "#FF9800",
  error: "#FF5724",
};

export function getChartConfig(color?: ColorType | "auto"): ApexOptions {
  if (!color || color === "auto") {
    color = "primary";
  }

  return {
    colors: [colors[color]],
    chart: {
      parentHeightOffset: 0,
      toolbar: {
        show: false,
      },
    },
    grid: {
      padding: {
        left: -18,
        right: 0,
        top: -30,
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: "55%",
      },
    },
    dataLabels: {
      enabled: false,
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
}
