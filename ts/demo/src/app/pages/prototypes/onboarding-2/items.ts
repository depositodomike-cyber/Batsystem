import { ElementType } from "react";
import { To } from "react-router";

import Creativedesign from "@/assets/illustrations/creativedesign-amber.svg?react";
import Performance from "@/assets/illustrations/performance-indigo.svg?react";
import Responsive from "@/assets/illustrations/responsive-rose.svg?react";

export interface Item {
  id: number;
  title: string;
  Image: ElementType;
  colorClasses: string;
  description: string;
  action: To;
  actionLabel: string;
}

export const items: Item[] = [
  {
    id: 1,
    title: "Creative Design",
    Image: Creativedesign,
    colorClasses: "from-amber-400 to-orange-600",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloribus eius in qui!",
    action: "/",
    actionLabel: "Start Design",
  },
  {
    id: 2,
    title: "Fully Responsive",
    Image: Responsive,
    colorClasses: "from-pink-500 to-rose-500",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ea ipsam odio totam?",
    action: "/",
    actionLabel: "Start Design",
  },
  {
    id: 3,
    title: "Performance",
    Image: Performance,
    colorClasses: "from-purple-500 to-indigo-600",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum necessitatibus quas sit.",
    action: "/",
    actionLabel: "Start Design",
  },
];
