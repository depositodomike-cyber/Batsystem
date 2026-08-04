// Import Dependencies
import { FaHistory } from "react-icons/fa";

// Local Imports
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

export function Time() {
  return (
    <Card className="flex flex-1 flex-col p-4">
      <div className="flex grow flex-col items-center">
        <div className="bg-warning flex h-16 w-12 items-center justify-center rounded-full">
          <FaHistory className="size-5 text-white" />
        </div>
        <p className="mt-2 font-medium">Time</p>
      </div>
      <div className="mt-3 text-center">
        <p className="dark:text-dark-100 text-3xl font-semibold text-gray-600">
          16
        </p>
        <p className="text-xs-plus">minutes</p>
      </div>
    </Card>
  );
}
