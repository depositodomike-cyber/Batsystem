// Local Imports
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

export interface Award {
  id: string;
  image: string;
  label: string;
  description: string;
}

export function AwardCard({ image, label, description }: Award) {
  return (
    <Card className="flex min-w-0 items-center space-x-3 p-4">
      <div>
        <img className="size-10" src={image} alt={label} />
      </div>
      <div>
        <p className="text-base font-medium text-gray-700 dark:text-gray-100">
          {label}
        </p>
        <p className="dark:text-dark-300 truncate text-xs text-gray-400">
          {description}
        </p>
      </div>
    </Card>
  );
}
