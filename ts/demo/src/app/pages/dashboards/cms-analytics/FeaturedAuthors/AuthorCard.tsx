// Import Dependencies
import {
  ChatBubbleOvalLeftEllipsisIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

// Types
interface Award {
  uid: number;
  label: string;
  image: string;
}

export interface Author {
  uid: string;
  name: string;
  avatar?: string;
  messages?: number;
  mails?: number;
  posts: string;
  views: string;
  followers: string;
  awards: Award[];
}

export function AuthorCard({
  name,
  avatar,
  messages,
  mails,
  posts,
  views,
  followers,
  awards,
}: Author) {
  return (
    <Card skin="shadow" className="w-72 shrink-0 space-y-9 p-4 sm:p-5">
      <div className="flex justify-between gap-2">
        <div className="flex items-center gap-3">
          <Avatar
            size={10}
            name={name}
            src={avatar}
            initialColor="auto"
            classNames={{
              display: "mask is-squircle rounded-none",
            }}
          />
          <div>
            <p className="dark:text-dark-100 font-medium text-gray-800">
              {name}
            </p>
            <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
              Writer
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button className="size-7" color="primary" variant="soft" isIcon>
              <ChatBubbleOvalLeftEllipsisIcon className="size-4" />
            </Button>
            {messages && (
              <div className="bg-primary-600 text-tiny dark:bg-primary-500 pointer-events-none absolute top-0 right-0 -m-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 leading-none font-medium text-white">
                {messages}
              </div>
            )}
          </div>
          <div className="relative">
            <Button className="size-7" color="primary" variant="soft" isIcon>
              <EnvelopeIcon className="size-4" />
            </Button>
            {mails && (
              <div className="bg-primary-600 text-tiny dark:bg-primary-500 pointer-events-none absolute top-0 right-0 -m-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 leading-none font-medium text-white">
                {mails}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <div>
          <p className="text-xs-plus">Posts</p>
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            {posts}
          </p>
        </div>
        <div>
          <p className="text-xs-plus">Views</p>
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            {views}
          </p>
        </div>
        <div>
          <p className="text-xs-plus">Followers</p>
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            {followers}
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <div className="flex gap-2">
          {awards.map((award) => (
            <img
              data-tooltip
              data-tooltip-content={award.label}
              key={award.uid}
              className="size-6"
              src={award.image}
              alt={award.label}
            />
          ))}
        </div>
        <Button
          variant="flat"
          isIcon
          className="size-8 rounded-full ltr:-mr-1.5 rtl:-ml-1.5"
        >
          <Cog6ToothIcon className="size-5" />
        </Button>
      </div>
    </Card>
  );
}
