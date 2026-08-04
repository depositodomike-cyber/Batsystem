// Import Dependencies
import {
  ArrowUpRightIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

export interface Request {
  id: string;
  name: string;
  avatar?: string;
  request: string;
  date: string;
  time: string;
}

export function AppointmentsRequestsCard({
  name,
  avatar,
  request,
  date,
  time,
}: Request) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size={10} name={name} src={avatar} initialColor="auto" />

        <div>
          <h3 className="dark:text-dark-100 truncate font-medium text-gray-800">
            {name}
          </h3>
          <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
            {request}
          </p>
        </div>
      </div>
      <div>
        <p>{date}</p>
        <p className="dark:text-dark-100 text-xl font-medium text-gray-800">
          {time}
        </p>
      </div>
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button
            className="size-7 rounded-full"
            isIcon
            color="success"
            variant="soft"
          >
            <CheckIcon className="size-4" />
          </Button>
          <Button
            className="size-7 rounded-full"
            isIcon
            color="error"
            variant="soft"
          >
            <XMarkIcon className="size-4" />
          </Button>
        </div>
        <Button className="size-7 rounded-full" isIcon>
          <ArrowUpRightIcon className="size-3.5" />
        </Button>
      </div>
    </Card>
  );
}

