// Local Imports
import { Avatar, Card } from "@/components/ui";

// ----------------------------------------------------------------------

interface History {
  uid: string;
  avatar?: string;
  name: string;
  action: string;
  time: string;
}

const history = [
  {
    uid: "1",
    avatar: "/images/avatar/avatar-18.jpg",
    name: "Travis Fuller",
    action: "New Follower",
    time: "Just Now",
  },
  {
    uid: "2",
    avatar: undefined,
    name: "Alfredo Elliott",
    action: "New NFT",
    time: "1 hr ago",
  },
  {
    uid: "3",
    avatar: "/images/avatar/avatar-6.jpg",
    name: "Henry Curtis",
    action: "You liked NFT",
    time: "3 hr ago",
  },
  {
    uid: "4",
    avatar: "/images/avatar/avatar-11.jpg",
    name: "Kartina West",
    action: "Added New NFT",
    time: "5 hr ago",
  },
  {
    uid: "5",
    avatar: "/images/avatar/avatar-4.jpg",
    name: "Lance Tucker",
    action: "Added New NFT",
    time: "11 hr ago",
  },
];

export function History() {
  return (
    <Card className="px-4 pb-4">
      <div className="flex h-14 min-w-0 items-center justify-between py-3">
        <h2 className="dark:text-dark-100 font-medium tracking-wide text-gray-800">
          History
        </h2>
        <a
          href="##"
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          View All
        </a>
      </div>
      <div className="space-y-4">
        {history.map((item) => (
          <div
            key={item.uid}
            className="flex min-w-0 items-center justify-between gap-2"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <Avatar
                size={10}
                src={item.avatar}
                name={item.name}
                initialColor="auto"
                classNames={{
                  display: "mask is-hexagon rounded-none",
                }}
              />

              <div className="flex min-w-0 flex-col">
                <span className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                  {item.action}
                </span>
                <span className="dark:text-dark-300 truncate text-xs font-medium text-gray-400">
                  by {item.name}
                </span>
              </div>
            </div>
            <span className="dark:text-dark-300 truncate text-end text-xs font-medium text-gray-400">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
