// Local Imports
import { Page } from "@/components/shared/Page";
import { OnboardingItem } from "./OnboardingItem";
import { items } from "./items";

// ----------------------------------------------------------------------

export default function Onboarding1() {
  return (
    <Page title="Onboarding v1">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <div className="py-5 text-center lg:py-6">
          <p className="text-sm uppercase">Are you new here?</p>
          <h3 className="dark:text-dark-100 mt-1 text-xl font-semibold text-gray-600">
            Welcome. Where do you like to Start?
          </h3>
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 lg:gap-6">
          {items.map((item) => (
            <OnboardingItem
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              action={item.action}
              actionLabel={item.actionLabel}
              Image={item.Image}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
