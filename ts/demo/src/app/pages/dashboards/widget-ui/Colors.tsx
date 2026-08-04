// Local Imports
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

export function Colors() {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-x-4">
        <div className="dark:border-dark-400 size-5 rounded-sm border-2 border-gray-200 bg-transparent"></div>
        <p>Neutral Color</p>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="border-primary-600 dark:border-primary-400 size-5 rounded-sm border-2 bg-transparent"></div>
        <p>Primary Color</p>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="border-secondary dark:border-secondary-light size-5 rounded-sm border-2 bg-transparent"></div>
        <p>Secondary Color</p>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="border-info dark:border-info-light size-5 rounded-sm border-2 bg-transparent"></div>
        <p>Info Color</p>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="border-success dark:border-success-light size-5 rounded-sm border-2 bg-transparent"></div>
        <p>Success Color</p>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="border-warning dark:border-warning-light size-5 rounded-sm border-2 bg-transparent"></div>
        <p>Warning Color</p>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="border-error dark:border-error-light size-5 rounded-sm border-2 bg-transparent"></div>
        <p>Error Color</p>
      </div>
    </Card>
  );
}
