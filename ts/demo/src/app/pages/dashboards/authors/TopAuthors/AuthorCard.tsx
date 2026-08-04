// Import Dependencies
import Chart from "react-apexcharts";
import { FaFacebook, FaInstagram, FaTwitter } from "react-icons/fa";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, AvatarProps, Button, Card } from "@/components/ui";
import { getChartConfig } from "./chartConfig";

// ----------------------------------------------------------------------
//0313

export interface Author {
  id: string;
  avatar: string;
  cover: string;
  color: AvatarProps["initialColor"];
  socialLinks: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
  };
  chartData: number[];
  name: string;
  location: string;
  postsCount: string;
  followers: {
    uid: string;
    name: string;
    avatar?: string;
  }[];
}

const socialIcons = {
  twitter: FaTwitter,
  instagram: FaInstagram,
  facebook: FaFacebook,
};

export function AuthorCard({
  avatar,
  cover,
  color,
  socialLinks,
  chartData,
  name,
  location,
  postsCount,
  followers,
}: Author) {
  const socialButtons = Object.entries(socialLinks).map(([label, link]) => ({
    label,
    Icon: socialIcons[label as keyof typeof socialIcons],
    link,
  }));

  return (
    <Card className="flex flex-col">
      <div className="bg-primary-500 h-20 rounded-t-lg">
        <img
          src={cover}
          alt="cover"
          className="h-full w-full rounded-t-lg object-cover object-center"
        />
      </div>
      <div className="flex grow flex-col px-4 py-2 sm:px-5">
        <div className="flex justify-between gap-4">
          <Avatar
            size={20}
            initialColor={color}
            name={name}
            src={avatar}
            classNames={{
              root: "-mt-12",
              display: "dark:border-dark-700 border-2 border-white text-2xl",
            }}
          />

          <div className="flex gap-2">
            {socialButtons.map((item) => (
              <Button
                key={item.label}
                color="primary"
                variant="soft"
                className="size-7 rounded-full"
                isIcon
                component="a"
                href={item.link}
                aria-label={item.label}
              >
                <item.Icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>
        <h3 className="dark:text-dark-100 pt-2 text-lg font-medium text-gray-800">
          {name}
        </h3>
        <p className="text-xs">{location}</p>

        <div className="flex grow items-center gap-3 py-3">
          <div className="min-w-0">
            <Chart
              className="ax-transparent-gridline w-2/3"
              series={[
                {
                  name: "Posts",
                  data: chartData,
                },
              ]}
              height="85"
              options={getChartConfig(color)}
              type="bar"
            />
          </div>

          <div className="w-3/12 text-center">
            <p className="dark:text-dark-100 text-xl font-medium text-gray-800">
              {postsCount}
            </p>
            <p className="text-xs-plus">Posts</p>
          </div>
        </div>

        <div className="flex justify-between py-2">
          <div className="flex -space-x-2">
            {followers.map((follower) => (
              <Avatar
                size={7}
                key={follower.uid}
                name={follower.name}
                src={follower.avatar}
                initialColor="auto"
                classNames={{
                  display: "dark:ring-dark-700 text-xs ring-2 ring-white",
                }}
              />
            ))}
          </div>

          <Button
            className="size-7 rounded-full ltr:-mr-2 rtl:-ml-2"
            variant="flat"
            isIcon
          >
            <Cog6ToothIcon className="size-4.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
