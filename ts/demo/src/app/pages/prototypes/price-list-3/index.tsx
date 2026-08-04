// Import Dependencies
import {
  BriefcaseIcon,
  CheckIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Button } from "@/components/ui";
import { plan1, plan2, plan3 } from "./data";
// ----------------------------------------------------------------------

export default function PriceList3() {
  return (
    <Page title="Price List v3">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <div className="py-5 text-center lg:py-6">
          <p className="text-sm uppercase">Are you new here?</p>
          <h3 className="dark:text-dark-100 mt-1 text-xl font-semibold text-gray-600">
            Welcome. Where do you like to Start?
          </h3>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5 2xl:gap-6">
          <div className="rounded-xl bg-linear-to-br from-pink-500 to-rose-500 p-1">
            <div className="dark:bg-dark-900 rounded-lg bg-gray-50 p-4 text-center sm:p-5">
              <div className="mt-8">
                <UserIcon className="text-secondary dark:text-secondary-light inline size-16" />
              </div>
              <div className="mt-5">
                <h4 className="dark:text-dark-100 text-xl font-semibold text-gray-600">
                  Personal
                </h4>
                <p>the starter choise</p>
              </div>
              <div className="mt-5">
                <span className="text-secondary dark:text-secondary-light text-4xl tracking-tight">
                  $5
                </span>
                /month
              </div>
              <div className="mt-8 space-y-4 text-left">
                {plan1.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        item.avaliable
                          ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                          : "bg-warning/10 text-warning dark:bg-warning-light/10 dark:text-warning-light",
                      )}
                    >
                      {item.avaliable ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <XMarkIcon className="size-4" />
                      )}
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Button className="rounded-full" color="secondary">
                  Choose Plan
                </Button>
              </div>
            </div>
          </div>

          <div className="from-primary-600 to-primary-500 rounded-xl bg-linear-to-br p-1">
            <div className="dark:bg-dark-900 rounded-lg bg-gray-50 p-4 text-center sm:p-5">
              <div className="mt-8">
                <UsersIcon className="text-primary-600 dark:text-primary-400 inline size-16" />
              </div>
              <div className="mt-5">
                <h4 className="dark:text-dark-100 text-xl font-semibold text-gray-600">
                  Team
                </h4>
                <p>the starter choise</p>
              </div>
              <div className="mt-5">
                <span className="text-primary-600 dark:text-primary-400 text-4xl tracking-tight">
                  $15
                </span>
                /month
              </div>
              <div className="mt-8 space-y-4 text-left">
                {plan2.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        item.avaliable
                          ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                          : "bg-warning/10 text-warning dark:bg-warning-light/10 dark:text-warning-light",
                      )}
                    >
                      {item.avaliable ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <XMarkIcon className="size-4" />
                      )}
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Button className="rounded-full" color="primary">
                  Choose Plan
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-linear-to-br from-amber-400 to-orange-600 p-1">
            <div className="dark:bg-dark-900 rounded-lg bg-gray-50 p-4 text-center sm:p-5">
              <div className="mt-8">
                <BriefcaseIcon className="text-warning inline size-16" />
              </div>
              <div className="mt-5">
                <h4 className="dark:text-dark-100 text-xl font-semibold text-gray-600">
                  Business
                </h4>
                <p>the starter choise</p>
              </div>
              <div className="mt-5">
                <span className="text-warning text-4xl tracking-tight">
                  $25
                </span>
                /month
              </div>
              <div className="mt-8 space-y-4 text-left">
                {plan3.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        item.avaliable
                          ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                          : "bg-warning/10 text-warning dark:bg-warning-light/10 dark:text-warning-light",
                      )}
                    >
                      {item.avaliable ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <XMarkIcon className="size-4" />
                      )}
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Button className="rounded-full" color="warning">
                  Choose Plan
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
