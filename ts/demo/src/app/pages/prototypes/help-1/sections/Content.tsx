// Import Dependencies
import {
  ArrowTrendingUpIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import {
  Accordion,
  AccordionButton,
  AccordionItem,
  AccordionPanel,
  Avatar,
  Button,
  Card,
} from "@/components/ui";

// ----------------------------------------------------------------------

export function Content() {
  return (
    <div className="col-span-12 lg:col-span-8 xl:col-span-9">
      <div className="flex items-center gap-2 pb-4">
        <div className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 flex size-7 items-center justify-center rounded-lg p-1.5">
          <ArrowTrendingUpIcon className="h-full w-full stroke-2" />
        </div>
        <h4 className="dark:text-dark-100 text-lg font-medium text-gray-800">
          Getting Started
        </h4>
      </div>
      <Accordion
        defaultValue="item-1"
        className="flex flex-col space-y-4 rounded-lg"
      >
        {Array(16)
          .fill(null)
          .map((_, i) => (
            <AccordionItem key={i} component={Card} value={"item-" + (i + 1)}>
              <AccordionButton className="ring-primary-500/50 dark:text-dark-100 dark:ring-offset-dark-700 flex w-full cursor-pointer items-center justify-between rounded-lg p-4 text-base font-medium text-gray-700 ring-offset-2 ring-offset-white outline-hidden focus-visible:ring-3 sm:px-5">
                {({ open }) => (
                  <>
                    <p>Question {i + 1}</p>
                    <div
                      className={clsx(
                        "dark:text-dark-300 text-sm leading-none font-normal text-gray-400 transition-transform duration-300",
                        open && "-rotate-180",
                      )}
                    >
                      <ChevronDownIcon className="size-6" />
                    </div>
                  </>
                )}
              </AccordionButton>
              <AccordionPanel className="p-4 pt-0 sm:px-5">
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                  Commodi earum magni officiis possimus repellendus. Accusantium
                  adipisci aliquid praesentium quaerat voluptate.
                </p>
                <div className="mt-4 flex justify-between space-x-2">
                  <div className="flex flex-wrap -space-x-1.5">
                    <Avatar
                      src="/images/avatar/avatar-5.jpg"
                      size={7}
                      classNames={{
                        root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
                        display:
                          "text-xs-plus dark:ring-dark-700 ring-3 ring-white",
                      }}
                    />

                    <Avatar
                      size={7}
                      classNames={{
                        root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
                        display:
                          "text-xs-plus dark:ring-dark-700 ring-3 ring-white",
                      }}
                      name="John Doe"
                      initialColor="info"
                    />

                    <Avatar
                      src="/images/avatar/avatar-18.jpg"
                      size={7}
                      classNames={{
                        root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
                        display:
                          "text-xs-plus dark:ring-dark-700 ring-3 ring-white",
                      }}
                    />

                    <Avatar
                      src="/images/avatar/avatar-19.jpg"
                      size={7}
                      classNames={{
                        root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
                        display:
                          "text-xs-plus dark:ring-dark-700 ring-3 ring-white",
                      }}
                    />
                  </div>
                  <Button className="size-7 shrink-0 rounded-full p-0">
                    <ArrowUpRightIcon className="size-4.5" />
                  </Button>
                </div>
              </AccordionPanel>
            </AccordionItem>
          ))}
      </Accordion>
    </div>
  );
}
