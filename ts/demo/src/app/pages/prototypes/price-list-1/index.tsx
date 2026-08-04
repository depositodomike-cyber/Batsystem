// Import Dependencies
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { FaCar, FaPlane, FaRocket } from "react-icons/fa";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Badge, Button, Card } from "@/components/ui";
import { plan1, plan2, plan3 } from "./data";

// ----------------------------------------------------------------------

export default function PriceList1() {
  return (
    <Page title="Price List v1">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <div className="py-5 text-center lg:py-6">
          <p className="text-sm uppercase">Are you new here?</p>
          <h3 className="dark:text-dark-100 mt-1 text-xl font-semibold text-gray-600">
            Welcome. Where do you like to Start?
          </h3>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5 2xl:gap-6">
          <Card className="p-4 text-center sm:p-5">
            <div className="mt-8">
              <FaCar className="text-primary-600 dark:text-primary-400 inline size-16" />
            </div>
            <div className="mt-5">
              <h4 className="dark:text-dark-100 text-xl font-semibold text-gray-600">
                Basic
              </h4>
              <p>the starter choise</p>
            </div>
            <div className="mt-5">
              <span className="text-primary-600 dark:text-primary-400 text-4xl tracking-tight">
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
              <Button className="rounded-full" variant="outlined">
                <span className="text-primary-600 dark:text-primary-400">
                  Choose Plan
                </span>
              </Button>
            </div>
          </Card>

          <Card className="p-4 text-center sm:p-5">
            <div className="absolute top-0 right-0 p-3">
              <Badge color="info" className="rounded-full">
                Recommended
              </Badge>
            </div>
            <div className="mt-8">
              <FaPlane className="text-primary-600 dark:text-primary-400 inline size-16" />
            </div>
            <div className="mt-5">
              <h4 className="dark:text-dark-100 text-xl font-semibold text-gray-600">
                Pro
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
          </Card>

          <Card className="p-4 text-center sm:p-5">
            <div className="mt-8">
              <FaRocket className="text-primary-600 dark:text-primary-400 inline size-16" />
            </div>
            <div className="mt-5">
              <h4 className="dark:text-dark-100 text-xl font-semibold text-gray-600">
                Enterprice
              </h4>
              <p>the starter choise</p>
            </div>
            <div className="mt-5">
              <span className="text-primary-600 dark:text-primary-400 text-4xl tracking-tight">
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
              <Button className="rounded-full" variant="outlined">
                <span className="text-primary-600 dark:text-primary-400">
                  Choose Plan
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
