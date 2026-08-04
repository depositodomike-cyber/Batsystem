// Import Dependencies
import {
  ClockIcon,
  HashtagIcon,
  ShareIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------

export function Menu() {
  return (
    <ul className="space-y-1.5 px-2 font-medium">
      <li>
        <Button
          variant="flat"
          className="group text-xs-plus w-full justify-start gap-2 p-2"
        >
          <ShareIcon className="dark:text-dark-300 dark:group-hover:text-dark-200 dark:group-focus:text-dark-200 size-4.5 text-gray-400 transition-colors group-hover:text-gray-500 group-focus:text-gray-500" />
          <span>Shared Folders</span>
        </Button>
      </li>
      <li>
        <Button
          variant="flat"
          className="group text-xs-plus w-full justify-start gap-2 p-2"
        >
          <StarIcon className="dark:text-dark-300 dark:group-hover:text-dark-200 dark:group-focus:text-dark-200 size-4.5 text-gray-400 transition-colors group-hover:text-gray-500 group-focus:text-gray-500" />
          <span>Important</span>
        </Button>
      </li>
      <li>
        <Button
          variant="flat"
          className="group text-xs-plus w-full justify-start gap-2 p-2"
        >
          <ClockIcon className="dark:text-dark-300 dark:group-hover:text-dark-200 dark:group-focus:text-dark-200 size-4.5 text-gray-400 transition-colors group-hover:text-gray-500 group-focus:text-gray-500" />
          <span>Recent</span>
        </Button>
      </li>
      <li>
        <Button
          variant="flat"
          className="group text-xs-plus w-full justify-start gap-2 p-2"
        >
          <HashtagIcon className="dark:text-dark-300 dark:group-hover:text-dark-200 dark:group-focus:text-dark-200 size-4.5 text-gray-400 transition-colors group-hover:text-gray-500 group-focus:text-gray-500" />
          <span>Tags</span>
        </Button>
      </li>
      <li>
        <Button
          variant="flat"
          color="error"
          className="group text-xs-plus w-full justify-start gap-2 p-2"
        >
          <TrashIcon className="size-4.5" />
          <span>Trash</span>
        </Button>
      </li>
    </ul>
  );
}
