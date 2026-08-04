// Import Dependencies
import { ChartBarIcon } from "@heroicons/react/20/solid";
import {
  ArrowPathIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

// ----------------------------------------------------------------------

export function Statistics() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:order-first sm:grid-cols-4 sm:gap-5 lg:gap-6">
      <div className="dark:border-dark-600 rounded-lg border border-gray-200 p-3">
        <div className="flex justify-between gap-1">
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            $5,679
          </p>
          <CpuChipIcon className="this:primary text-this dark:text-this-light size-5 shrink-0" />
        </div>
        <p className="text-xs-plus mt-1 truncate">Total Mining</p>
      </div>
      <div className="dark:border-dark-600 rounded-lg border border-gray-200 p-3">
        <div className="flex justify-between gap-1">
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            $12.6k
          </p>
          <ChartBarIcon className="this:success text-this dark:text-this-light size-5 shrink-0" />
        </div>
        <p className="text-xs-plus mt-1 truncate">Total Networth</p>
      </div>
      <div className="dark:border-dark-600 rounded-lg border border-gray-200 p-3">
        <div className="flex justify-between gap-1">
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            $10.3k
          </p>
          <CurrencyDollarIcon className="this:warning text-this dark:text-this-light size-5 shrink-0" />
        </div>
        <p className="text-xs-plus mt-1 truncate">Earnings</p>
      </div>
      <div className="dark:border-dark-600 rounded-lg border border-gray-200 p-3">
        <div className="flex justify-between gap-1">
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            651
          </p>
          <ArrowPathIcon className="this:info text-this dark:text-this-light size-5 shrink-0" />
        </div>
        <p className="text-xs-plus mt-1 truncate">Harvested Losses</p>
      </div>
    </div>
  );
}
