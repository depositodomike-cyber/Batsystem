// Local Imports
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

type Country = {
  uid: string;
  flag: string;
  name: string;
  sales: string;
  impression: number;
};

const countries: Country[] = [
  {
    uid: "1",
    flag: "/images/flags/svg/rounded/australia.svg",
    name: "Australia",
    sales: "$6.41k",
    impression: 2,
  },
  {
    uid: "2",
    flag: "/images/flags/svg/rounded/brazil.svg",
    name: "Brazil",
    sales: "$2.33k",
    impression: 1,
  },
  {
    uid: "3",
    flag: "/images/flags/svg/rounded/china.svg",
    name: "China",
    sales: "$7.23k",
    impression: 1,
  },
  {
    uid: "4",
    flag: "/images/flags/svg/rounded/india.svg",
    name: "India",
    sales: "$975",
    impression: -1,
  },
  {
    uid: "5",
    flag: "/images/flags/svg/rounded/italy.svg",
    name: "Italy",
    sales: "$699",
    impression: 1,
  },
  {
    uid: "6",
    flag: "/images/flags/svg/rounded/japan.svg",
    name: "Japan",
    sales: "$624",
    impression: 1,
  },
  {
    uid: "7",
    flag: "/images/flags/svg/rounded/russia.svg",
    name: "Russia",
    sales: "$579",
    impression: -1,
  },
  {
    uid: "8",
    flag: "/images/flags/svg/rounded/spain.svg",
    name: "Spain",
    sales: "$501",
    impression: 1,
  },
];

export function TopCountries() {
  return (
    <Card className="px-4 pb-5 sm:px-5">
      <div className="flex h-14 min-w-0 items-center justify-between py-3">
        <h2 className="dark:text-dark-100 truncate font-medium tracking-wide text-gray-800">
          Top Countries
        </h2>
        <a
          href="##"
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          View All
        </a>
      </div>
      <div>
        <p>
          <span className="dark:text-dark-100 text-2xl text-gray-800">64</span>
        </p>
        <p className="text-xs-plus">Countries</p>
      </div>
      <div className="mt-5 space-y-4">
        {countries.map((country) => (
          <div
            key={country.uid}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <img className="size-6" src={country.flag} alt={country.name} />
              <a
                href="##"
                className="truncate transition-opacity hover:opacity-80"
              >
                {country.name}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm-plus dark:text-dark-100 text-gray-800">
                {country.sales}
              </p>
              {country.impression > 0 ? (
                <ArrowUpIcon className="this:success text-this dark:text-this-lighter size-4" />
              ) : (
                <ArrowDownIcon className="this:error text-this dark:text-this-lighter size-4" />
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
