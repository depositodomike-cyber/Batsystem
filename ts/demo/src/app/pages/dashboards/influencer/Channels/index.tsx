// Import Dependencies
import { ArrowUpIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar } from "@/components/ui";
import { ChannelCard, Channel } from "./ChannelCard";

// ----------------------------------------------------------------------

const channels: Channel[] = [
  {
    id: "1",
    logo: "/images/logos/instagram-round.svg",
    name: "Instagram",
    username: "@theapp721",
    impression: "+2",
  },
  {
    id: "2",
    logo: "/images/logos/facebook-round.svg",
    name: "Facebook",
    username: "@theapp721",
    impression: "+3",
  },
  {
    id: "3",
    logo: "/images/logos/tik_tok-round.svg",
    name: "Tik Tok",
    username: "@ticktocco",
    impression: "+1",
  },
  {
    id: "4",
    logo: "/images/logos/twitter-round.svg",
    name: "Twitter",
    username: "@twaccount",
    impression: "+5",
  },
  {
    id: "5",
    logo: "/images/logos/pinterest-round.svg",
    name: "Pinterest",
    username: "@pinstudio",
    impression: "+1",
  },
  {
    id: "6",
    logo: "/images/logos/discord-round.svg",
    name: "Discord",
    username: "@serverdiscord",
    impression: "+3",
  },
  {
    id: "7",
    logo: "/images/logos/youtube-round.svg",
    name: "Youtube",
    username: "@channelyou",
    impression: "+2",
  },
  {
    id: "8",
    logo: "/images/logos/tumblr-round.svg",
    name: "Tumblr",
    username: "@tum532",
    impression: "+1",
  },
];

export function Channels() {
  return (
    <div className="bg-info/10 dark:bg-dark-800 flex flex-col rounded-xl py-5 lg:flex-row">
      <div className="flex min-w-0 flex-col px-4 sm:px-5 lg:w-48 lg:shrink-0 lg:py-3">
        <h3 className="truncate text-base font-medium tracking-wide text-gray-700 lg:text-lg dark:text-gray-100">
          Channels
        </h3>
        <p className="mt-3 grow">
          Channels analytics calculated based on your activity
        </p>
        <div className="mt-3 flex items-center space-x-2">
          <Avatar size={7} initialColor="success" initialVariant="soft">
            <ArrowUpIcon className="size-4" />
          </Avatar>
          <p className="dark:text-dark-100 text-base font-medium text-gray-800">
            3.3%
          </p>
        </div>
      </div>

      <div className="hide-scrollbar mt-5 flex space-x-4 overflow-x-auto px-4 sm:px-5 lg:mt-0 lg:pl-0">
        {channels.map((channel) => (
          <ChannelCard key={channel.id} {...channel} />
        ))}
      </div>
    </div>
  );
}
