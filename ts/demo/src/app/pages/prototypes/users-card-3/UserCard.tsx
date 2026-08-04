// Import Dependencies
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { EnvelopeIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button, Card } from "@/components/ui";
import { Highlight } from "@/components/shared/Highlight";
import { User } from "./data";

// ----------------------------------------------------------------------

export function UserCard({
  name,
  avatar,
  tags,
  query,
}: User & { query: string }) {
  return (
    <Card className="flex grow flex-col items-center p-4 text-center sm:p-5">
      <Avatar
        size={18}
        src={avatar}
        name={name}
        classNames={{ display: "text-xl" }}
        initialColor="auto"
      />

      <div className="my-2 grow">
        <h3 className="dark:text-dark-100 text-base font-medium text-gray-800">
          <Highlight query={query}>{name}</Highlight>
        </h3>
        <div className="flex flex-wrap justify-center gap-1.5">
          {tags.map((tag, i) => (
            <a
              key={i}
              href="##"
              className="text-xs-plus text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
            >
              #<Highlight query={query}>{tag}</Highlight>
            </a>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center space-x-1">
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
    </Card>
  );
}
