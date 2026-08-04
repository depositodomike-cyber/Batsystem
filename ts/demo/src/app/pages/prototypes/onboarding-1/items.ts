import { ElementType } from "react";
import { To } from "react-router";

import BoyDashboard from "@/assets/illustrations/boy-dashboard.svg?react";
import GirlDesigning from "@/assets/illustrations/girl-designing.svg?react";
import ResponsiveDevicesGirl from "@/assets/illustrations/responsive-devices-girl.svg?react";

export interface Item {
  id: number;
  title: string;
  Image: ElementType;
  description: string;
  action: To;
  actionLabel: string;
}

export const items: Item[] = [
  {
    id: 1,
    title: "Creative Design",
    Image: BoyDashboard,
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloribus eius in qui!",
    action: "/",
    actionLabel: "Start Design",
  },
  {
    id: 2,
    title: "Fully Responsive",
    Image: GirlDesigning,
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ea ipsam odio totam?",
    action: "/",
    actionLabel: "Start Design",
  },
  {
    id: 3,
    title: "Performance",
    Image: ResponsiveDevicesGirl,
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum necessitatibus quas sit.",
    action: "/",
    actionLabel: "Start Design",
  },
];
