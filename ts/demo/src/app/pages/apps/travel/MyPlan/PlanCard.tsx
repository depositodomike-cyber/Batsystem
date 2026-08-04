// Import Dependencies
import { CalendarIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Card } from "@/components/ui";

// ----------------------------------------------------------------------

interface Member {
  uid: string;
  name: string;
  avatar?: string;
}

export interface Plan {
  uid: string;
  name: string;
  image: string;
  dateRange: string;
  members: Member[];
}

export function PlanCard({ name, image, dateRange, members }: Plan) {
  return (
    <Card className="flex gap-4 p-2">
      <img
        className="size-18 rounded-lg object-cover object-center"
        src={image}
        alt={name}
      />
      <div>
        <a
          href="##"
          className="hover:text-primary-600 focus:text-primary-600 dark:text-dark-100 dark:hover:text-primary-400 dark:focus:text-primary-400 font-medium text-gray-700"
        >
          {name}
        </a>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
          <CalendarIcon className="dark:text-dark-300 size-3.5 text-gray-400" />
          <span className="truncate">{dateRange}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap -space-x-1.5">
          {members.map((member) => (
            <Avatar
              key={member.uid}
              size={6}
              src={member.avatar}
              classNames={{
                root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
                display: "text-tiny-plus dark:ring-dark-700 ring-3 ring-white",
              }}
              name={member.name}
              initialColor="auto"
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
