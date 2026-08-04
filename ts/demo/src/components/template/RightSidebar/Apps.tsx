// Import Dependencies
import {
  BanknotesIcon,
  ChatBubbleBottomCenterIcon,
  CloudIcon,
  CurrencyDollarIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { ComponentType } from "react";

// Local Imports
import { Avatar, type AvatarProps } from "@/components/ui";
import { Link, type To } from "react-router";

// ----------------------------------------------------------------------

interface AppItem {
  id: string;
  Icon: ComponentType<{ className?: string }>;
  title: string;
  color: AvatarProps["initialColor"];
  to: To;
}

const apps: AppItem[] = [
  {
    id: "1",
    Icon: ViewColumnsIcon,
    title: "Kanban Board",
    color: "success",
    to: "/apps/kanban",
  },
  {
    id: "2",
    Icon: CurrencyDollarIcon,
    title: "Analytics",
    color: "warning",
    to: "/dashboards/crm-analytics",
  },
  {
    id: "3",
    Icon: ChatBubbleBottomCenterIcon,
    title: "Chat",
    color: "info",
    to: "/apps/chat",
  },
  {
    id: "4",
    Icon: CloudIcon,
    title: "File Manager",
    color: "error",
    to: "/apps/filemanager",
  },
  {
    id: "5",
    Icon: BanknotesIcon,
    title: "Banking",
    color: "secondary",
    to: "/dashboards/banking/banking-2",
  },
];

export function Apps({ close }: { close: () => void }) {
  return (
    <div className="mt-4">
      <h2 className="text-xs-plus dark:text-dark-100 line-clamp-1 px-3 font-medium tracking-wide text-gray-800">
        Pinned Apps
      </h2>
      <div className="mt-3 flex gap-3 px-3">
        {apps.map((app) => (
          <Link
            key={app.id}
            to={app.to}
            onClick={close}
            className="w-12 shrink-0 text-center"
          >
            <Avatar
              size={10}
              initialColor={app.color}
              classNames={{
                display: "mask is-squircle rounded-none",
              }}
            >
              <app.Icon className="size-5.5" />
            </Avatar>
            <span className="dark:text-dark-100 mt-1.5 block truncate text-xs whitespace-nowrap text-gray-800">
              {app.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
