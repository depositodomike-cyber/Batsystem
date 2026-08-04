// Import Dependencies
import {
  EllipsisHorizontalIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

export function AuthorInfo() {
  return (
    <Card>
      <div className="bg-primary-500 h-24 rounded-t-lg">
        <img
          className="h-full w-full rounded-t-lg object-cover object-center"
          src="/images/objects/object-7.jpg"
          alt="author"
        />
      </div>
      <div className="px-4 pt-2 pb-5 sm:px-5">
        <Avatar
          size={20}
          classNames={{
            root: "-mt-12",
            display: "dark:border-dark-700 border-2 border-white",
          }}
          src="/images/avatar/avatar-19.jpg"
        />
        <h3 className="dark:text-dark-100 pt-2 text-lg font-medium text-gray-800">
          Travis Fuller
        </h3>
        <p className="text-xs-plus dark:text-dark-300 text-gray-400">
          1,596 followers
        </p>
        <p className="mt-3">
          Professional product designer and amateur cyclist living in New York
          City, USA.
        </p>
        <div className="mt-5 flex gap-1">
          <Button className="text-xs-plus h-7 rounded-full px-3">Follow</Button>
          <Button
            className="size-7 rounded-full"
            isIcon
            aria-label="Send Message"
          >
            <EnvelopeIcon className="size-4 stroke-2" />
          </Button>
          <Button
            className="size-7 rounded-full"
            isIcon
            aria-label="User Actions"
          >
            <EllipsisHorizontalIcon className="size-4 stroke-2" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
