// Import Dependencies
import { HeartIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Highlight } from "@/components/shared/Highlight";
import { Button, Card } from "@/components/ui";
import { type Post } from "./data";
// ----------------------------------------------------------------------

export function PostCard({
  cover,
  category,
  created_at,
  title,
  description,
  likes,
  query,
}: Post & { query: string }) {
  return (
    <Card className="flex flex-col">
      <img
        src={cover}
        className="h-48 w-full rounded-t-lg object-cover object-center"
        alt={title}
      />
      <div className="flex grow flex-col p-4">
        <div className="flex">
          <a
            href="##"
            className="text-info dark:text-info-lighter truncate text-xs"
          >
            <Highlight query={query}>{category}</Highlight>
          </a>
          <div className="dark:bg-dark-500 mx-2 my-0.5 w-px bg-gray-200"></div>
          <span className="text-tiny-plus dark:text-dark-300 text-gray-400">
            {created_at}
          </span>
        </div>
        <div className="line-clamp-2 pt-2">
          <a
            href="##"
            className="hover:text-primary-600 focus:text-primary-600 dark:text-dark-100 dark:hover:text-primary-400 dark:focus:text-primary-400 text-base font-medium text-gray-700"
          >
            <Highlight query={query}>{title}</Highlight>
          </a>
        </div>
        <p className="grow pt-2">{description}</p>
        <div className="mt-3 text-end">
          <Button className="h-8 space-x-1.5 rounded-full px-4">
            <HeartIcon className="size-4.5" />
            <span>{likes}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
