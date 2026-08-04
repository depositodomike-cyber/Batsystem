// Import Dependencies
import { Label, Radio, RadioGroup } from "@headlessui/react";
import { useState } from "react";
import clsx from "clsx";

// Local Imports
import { Box } from "@/components/ui";
import { NftCard, type NftItem } from "./NftCard";

// ----------------------------------------------------------------------

interface Category {
  uid: string;
  label: string;
}

const categories: Category[] = [
  {
    uid: "1",
    label: "🔥 All",
  },
  {
    uid: "2",
    label: "🎨 Art",
  },
  {
    uid: "3",
    label: "🎵 Music",
  },
  {
    uid: "4",
    label: "🎯 Game",
  },
  {
    uid: "5",
    label: "👗 Fashion",
  },
  {
    uid: "6",
    label: "📸 Photograpgy",
  },
  {
    uid: "7",
    label: "🤽‍♂️ Sport",
  },
];

const items: NftItem[] = [
  {
    uid: "1",
    image: "/images/objects/object-11.jpg",
    time: "2 days left",
    name: "The Runner #265",
    artist: "Konnor Guzman",
    likes: "164",
    currentBid: "5.01",
  },
  {
    uid: "2",
    image: "/images/objects/object-12.jpg",
    time: "3 days left",
    name: "Punkiber #015",
    artist: "Katrina West",
    likes: "614",
    currentBid: "9.52",
  },
  {
    uid: "3",
    image: "/images/objects/object-13.jpg",
    time: "5 days left",
    name: "Cube Store #015",
    artist: "Travis Fuller",
    likes: "233",
    currentBid: "4.27",
  },
];

export function TrendingItems() {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);

  return (
    <Box>
      <div className="flex min-w-0 items-center justify-between py-5">
        <h3 className="dark:text-dark-50 truncate text-xl font-medium text-gray-800">
          Trending NFT&apos;s
        </h3>
        <a
          href="##"
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          View All
        </a>
      </div>
      <RadioGroup
        value={selectedCategory}
        onChange={setSelectedCategory}
        as="div"
        className="is-scrollbar-hidden overflow-x-auto"
      >
        <Label className="sr-only">Choose a category</Label>

        <div className="flex w-max gap-3 whitespace-nowrap">
          {categories.map((category) => (
            <Radio
              key={category.uid}
              as="button"
              value={category}
              className={({ checked }) =>
                clsx(
                  "tag-base tag rounded-full outline-hidden",
                  checked
                    ? "this:primary bg-this text-white"
                    : "bg-gray-150 dark:bg-dark-600 dark:text-dark-100 dark:hover:bg-dark-450 dark:focus:bg-dark-450 dark:active:bg-dark-450/90 text-gray-900 hover:bg-gray-200 focus:bg-gray-200 active:bg-gray-200/80",
                )
              }
            >
              {category.label}
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-3 sm:gap-5 lg:gap-6">
        {items.map((item) => (
          <NftCard key={item.uid} {...item} />
        ))}
      </div>
    </Box>
  );
}
