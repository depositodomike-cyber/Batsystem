// Import Dependencies
import { BookmarkIcon, HeartIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Highlight } from "@/components/shared/Highlight";
import { Button, Card } from "@/components/ui";
import { type Post } from "./data";

// ----------------------------------------------------------------------

export function PostCard({
  uid,
  created_at,
  cover,
  title,
  category,
  CategoryIcon,
  query,
}: Post & { query: string }) {
  return (
    <Card data-post-id={uid} className="flex grow flex-col">
      <img
        className="h-72 w-full rounded-lg object-cover object-center"
        src={cover}
        alt={title}
      />
      <div className="absolute inset-0 flex h-full w-full flex-col justify-end">
        <div className="rounded-lg bg-linear-to-t from-[#19213299] via-[#19213266] to-transparent px-4 pt-12 pb-3">
          <div className="line-clamp-2">
            <a
              href="##"
              className="text-base font-medium text-white hover:text-white/80"
            >
              <Highlight query={query}>{title}</Highlight>
            </a>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center text-xs text-white/80">
              <div className="flex min-w-0 items-center gap-1">
                <CategoryIcon className="size-3.5 shrink-0" />
                <span className="truncate">
                  <Highlight query={query}>{category}</Highlight>
                </span>
              </div>
              <div className="mx-3 my-0.5 w-px self-stretch bg-white/20"></div>
              <p className="text-tiny-plus shrink-0">{created_at}</p>
            </div>
            <div className="flex ltr:-mr-1.5 rtl:-ml-1.5">
              <Button
                data-tooltip
                data-tooltip-content="Like"
                unstyled
                className="size-7 rounded-full hover:bg-white/20"
              >
                <HeartIcon className="text-secondary-lighter size-4.5 stroke-2" />
              </Button>
              <Button
                data-tooltip
                data-tooltip-content="Save"
                unstyled
                className="size-7 rounded-full hover:bg-white/20"
              >
                <BookmarkIcon className="size-4.5 stroke-2 text-white" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
