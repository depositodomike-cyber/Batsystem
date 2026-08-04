// Local Imports
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

export function Technologies() {
  return (
    <Card className="px-4 pb-4 sm:px-5">
      <div className="flex h-14 items-center justify-between py-3">
        <h2 className="text-sm-plus dark:text-dark-100 truncate font-medium tracking-wide text-gray-800">
          Technologies
        </h2>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className="this:primary bg-this dark:bg-this-lighter w-4/12 rounded-full"></div>
        <div className="this:secondary bg-this dark:bg-this-lighter w-3/12 rounded-full"></div>
        <div className="this:info bg-this dark:bg-this-lighter w-2/12 rounded-full"></div>
        <div className="this:success bg-this dark:bg-this-lighter w-2/12 rounded-full"></div>
        <div className="this:error bg-this dark:bg-this-lighter w-1/12 rounded-full"></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 leading-none">
          <span className="this:primary bg-this dark:bg-this-lighter size-2 rounded-full" />
          <span>Primary</span>
        </span>
        <span className="inline-flex items-center gap-2 leading-none">
          <span className="this:secondary bg-this dark:bg-this-lighter size-2 rounded-full" />
          <span>Secondary</span>
        </span>
        <span className="inline-flex items-center gap-2 leading-none">
          <span className="this:info bg-this dark:bg-this-lighter size-2 rounded-full" />
          <span>Info</span>
        </span>
        <span className="inline-flex items-center gap-2 leading-none">
          <span className="this:success bg-this dark:bg-this-lighter size-2 rounded-full" />
          <span>Success</span>
        </span>
        <span className="inline-flex items-center gap-2 leading-none">
          <span className="this:warning bg-this dark:bg-this-lighter size-2 rounded-full" />
          <span>Warning</span>
        </span>
        <span className="inline-flex items-center gap-2 leading-none">
          <span className="this:error bg-this dark:bg-this-lighter size-2 rounded-full" />
          <span>Error</span>
        </span>
      </div>
    </Card>
  );
}
