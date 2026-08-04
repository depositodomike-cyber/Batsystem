// Import Dependencies
import { ChatBubbleOvalLeftEllipsisIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, AvatarDot, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

export interface Student {
  id: string;
  name: string;
  messagesCount?: number;
  avatar?: string;
  isOnline: boolean;
  progress: number;
}

export function StudentCard({
  name,
  messagesCount,
  avatar,
  isOnline,
  progress,
}: Student) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-x-3">
        <Avatar
          size={10}
          name={name}
          src={avatar}
          initialColor="auto"
          classNames={{
            display: "text-sm",
          }}
          indicator={
            <AvatarDot
              color={isOnline ? "primary" : "neutral"}
              className="right-0 -m-0.5"
            />
          }
        />
        <div className="min-w-0">
          <p className="dark:text-dark-100 truncate font-medium text-gray-800">
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs">{progress}% completed</p>
        </div>
      </div>
      <div className="relative">
        <Button className="size-8 rounded-full" isIcon>
          <ChatBubbleOvalLeftEllipsisIcon className="size-4.5" />
        </Button>
        {messagesCount && messagesCount > 0 && (
          <div className="bg-primary-600 text-tiny dark:bg-primary-500 pointer-events-none absolute top-0 right-0 -m-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 leading-none font-medium text-white">
            {messagesCount}
          </div>
        )}
      </div>
    </Card>
  );
}
