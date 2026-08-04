// Local Imports
import { Avatar, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

export interface Artist {
  uid: string;
  cover: string;
  avatar?: string;
  name: string;
  itemsCount: string;
}

export function ArtistCard({ cover, avatar, name, itemsCount }: Artist) {
  return (
    <Card className="flex flex-col items-center pb-5 text-center">
      <img
        className="h-24 w-full rounded-t-lg object-cover object-center"
        src={cover}
        alt={name}
      />

      <Avatar
        size={20}
        name={name}
        src={avatar}
        classNames={{
          root: "-mt-12",
          display: "dark:border-dark-700 border-2 border-white text-xl",
        }}
      />

      <div className="mt-1.5 px-2">
        <a
          href="##"
          className="hover:text-primary-600 focus:text-primary-600 dark:text-dark-100 dark:hover:text-primary-400 dark:focus:text-primary-400 truncate text-base font-medium text-gray-700"
        >
          {name}
        </a>
        <p className="dark:text-dark-300 text-xs text-gray-400">
          {itemsCount} items
        </p>
        <Button color="primary" className="mt-4 h-8 min-w-[7rem] rounded-full">
          Follow
        </Button>
      </div>
    </Card>
  );
}
