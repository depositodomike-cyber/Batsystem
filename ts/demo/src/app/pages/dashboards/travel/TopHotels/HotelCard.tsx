// Import Dependencies
import { StarIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Box, Tag } from "@/components/ui";
import { ColorType } from "@/constants/app";

// ----------------------------------------------------------------------

export type TagType = "plus" | "lux" | "penthouse";

export interface Hotel {
  id: string;
  cover: string;
  name: string;
  tag: TagType;
  price: number;
  rating: number;
  bedsCount: number;
  adultCount: number;
}

const tags: Record<TagType, { label: string; color: ColorType }> = {
  plus: {
    label: "Plus",
    color: "info",
  },
  lux: {
    label: "Lux",
    color: "warning",
  },
  penthouse: {
    label: "Penthouse",
    color: "secondary",
  },
};

export function HotelCard({
  cover,
  name,
  tag,
  price,
  rating,
  adultCount,
  bedsCount,
}: Hotel) {
  return (
    <Box className="flex w-72 shrink-0 flex-col">
      <img
        className="h-48 w-full rounded-2xl object-cover object-center"
        src={cover}
        alt={name}
      />
      <Box className="shadow-soft dark:bg-dark-700 mx-2 -mt-8 grow rounded-2xl bg-white p-3.5 dark:shadow-none">
        <div className="flex space-x-2">
          <Tag
            href="#"
            className="h-5 rounded-full uppercase"
            color={tags[tag].color}
          >
            {tags[tag].label}
          </Tag>
          <div className="flex flex-wrap items-center text-xs uppercase">
            <p>{bedsCount} beds</p>
            <div className="dark:bg-dark-500 mx-2 my-1 w-px self-stretch bg-gray-200"></div>
            <p>{adultCount} Adult</p>
          </div>
        </div>
        <div className="mt-2">
          <a
            href="##"
            className="text-sm-plus hover:text-primary-600 focus:text-primary-600 dark:text-dark-100 dark:hover:text-primary-400 dark:focus:text-primary-400 truncate font-medium text-gray-700"
          >
            {name}
          </a>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <p>
            <span className="dark:text-dark-100 text-base font-medium text-gray-800">
              ${price}
            </span>
            <span className="dark:text-dark-300 text-xs text-gray-400">
              /day
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <StarIcon className="dark:text-dark-300 size-3.5 text-gray-400" />
            <span>{rating}</span>
          </div>
        </div>
      </Box>
    </Box>
  );
}
