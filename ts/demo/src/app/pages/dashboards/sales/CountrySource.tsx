// Import Dependencies
import { EyeIcon } from "@heroicons/react/20/solid";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { CSSProperties } from "react";

// Local Imports
import { Badge, Box, Card } from "@/components/ui";
import { formatNumber } from "@/utils/formatNumber";

// ----------------------------------------------------------------------

interface CountrySource {
  uid: number;
  flag: string;
  name: string;
  view: number;
  viewImpression: number;
  sales: number;
  salesImpression: number;
}

const countries: CountrySource[] = [
  {
    uid: 1,
    flag: "/images/flags/svg/rounded/spain.svg",
    name: "Spain",
    view: 2369,
    viewImpression: 1,
    sales: 36516,
    salesImpression: -1,
  },
  {
    uid: 2,
    flag: "/images/flags/svg/rounded/australia.svg",
    name: "Australia",
    view: 8646,
    viewImpression: 1,
    sales: 94113,
    salesImpression: 1,
  },
  {
    uid: 3,
    flag: "/images/flags/svg/rounded/italy.svg",
    name: "Italy",
    view: 1934,
    viewImpression: -1,
    sales: 21691,
    salesImpression: -1,
  },
  {
    uid: 4,
    flag: "/images/flags/svg/rounded/japan.svg",
    name: "Japan",
    view: 794,
    viewImpression: -1,
    sales: 5691,
    salesImpression: 1,
  },
  {
    uid: 5,
    flag: "/images/flags/svg/rounded/russia.svg",
    name: "Russia",
    view: 426,
    viewImpression: 1,
    sales: 3259,
    salesImpression: -1,
  },
];

export function CountrySource() {
  return (
    <Card className="pb-4">
      <div className="flex h-14 min-w-0 items-center justify-between px-4 py-3 sm:px-5">
        <h2 className="dark:text-dark-100 min-w-0 font-medium tracking-wide text-gray-800">
          Country Source
        </h2>
        <a
          href="##"
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          View All
        </a>
      </div>

      <div className="-mt-2 px-4 sm:px-5">
        <p>
          <span className="dark:text-dark-100 text-2xl text-gray-800">93</span>
          <span className="text-success dark:text-success-lighter text-xs">
            {" "}
            +1.3%
          </span>
        </p>
        <p className="text-xs-plus">Country in this month</p>
      </div>

      <div
        className="custom-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 whitespace-nowrap sm:px-5"
        style={{ "--margin-scroll": "1.25rem" } as CSSProperties}
      >
        {countries.map((country) => (
          <Box
            key={country.uid}
            className="border-gray-150 dark:border-dark-600 inline-flex shrink-0 items-center gap-4 rounded-lg border p-2"
          >
            <div className="flex items-center gap-2">
              <img className="size-6" src={country.flag} alt={country.name} />
              <span>{country.name}</span>
            </div>
            <div className="flex gap-1.5">
              <Badge
                className="h-5 gap-1 rounded-full font-bold"
                color={country.viewImpression === 1 ? "success" : "error"}
                variant="soft"
              >
                <EyeIcon className="size-3.5" />
                <span>{formatNumber(country.view)}</span>
                {country.viewImpression === 1 ? (
                  <ArrowTrendingUpIcon className="size-3.5" />
                ) : (
                  <ArrowTrendingDownIcon className="size-3.5" />
                )}
              </Badge>
              <Badge
                className="h-5 gap-1 rounded-full font-bold"
                color={country.salesImpression === 1 ? "success" : "error"}
                variant="soft"
              >
                <span>{formatNumber(country.sales)}</span>
                {country.salesImpression === 1 ? (
                  <ArrowTrendingUpIcon className="size-3.5" />
                ) : (
                  <ArrowTrendingDownIcon className="size-3.5" />
                )}
              </Badge>
            </div>
          </Box>
        ))}
      </div>
    </Card>
  );
}
