// Import Dependencies
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Button, Card } from "@/components/ui";
import { plan1, plan2, plan3 } from "./data";

// ----------------------------------------------------------------------

export default function PriceList4() {
  return (
    <Page title="Price List v4">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <div className="py-5 text-center lg:py-6">
          <p className="text-sm uppercase">Are you new here?</p>
          <h3 className="dark:text-dark-100 mt-1 text-xl font-semibold text-gray-600">
            Welcome. Where do you like to Start?
          </h3>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5 2xl:gap-6">
          <Card>
            <div className="bg-gray-150 dark:bg-dark-800 rounded-t-lg p-4 text-center sm:p-5">
              <p className="dark:text-dark-100 text-xl font-medium text-gray-800">
                Basic
              </p>
              <p className="dark:text-dark-50 mt-3 text-5xl font-semibold text-gray-800">
                $50
              </p>
              <p className="mt-3">/month</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="mt-3 space-y-4 text-left">
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
                <Button className="w-full">Choose Plan</Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="bg-primary-500 rounded-t-lg p-4 text-center sm:p-5">
              <p className="text-xl font-medium text-white">Pro</p>
              <p className="mt-3 text-5xl font-semibold text-white">$150</p>
              <p className="mt-3 text-white/80">/month</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="mt-3 space-y-4 text-left">
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
                <Button className="w-full" color="primary">
                  Choose Plan
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="bg-gray-150 dark:bg-dark-800 rounded-t-lg p-4 text-center sm:p-5">
              <p className="dark:text-dark-100 text-xl font-medium text-gray-800">
                Enterprice
              </p>
              <p className="dark:text-dark-50 mt-3 text-5xl font-semibold text-gray-800">
                $250
              </p>
              <p className="mt-3">/month</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="mt-3 space-y-4 text-left">
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
                <Button className="w-full">Choose Plan</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
