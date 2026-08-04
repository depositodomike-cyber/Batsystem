// Import Dependencies
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Avatar, Button, Card, Tag } from "@/components/ui";
import { ColorType } from "@/constants/app";

// ----------------------------------------------------------------------
interface Student {
  uid: string;
  name: string;
  avatar?: string;
}

export interface Class {
  id: string;
  image: string;
  name: string;
  category: string;
  time: string;
  color: ColorType;
  students: Student[];
}

export function ClassCard({
  image,
  name,
  category,
  time,
  color,
  students,
}: Class) {
  return (
    <Card className="flex overflow-hidden">
      <div
        className={clsx(
          `this:${color}`,
          "bg-this dark:bg-this-light h-full w-1",
        )}
      />
      <div className="flex flex-1 flex-col justify-between p-4 sm:px-5">
        <div>
          <img
            className="size-12 rounded-lg object-cover object-center"
            src={image}
            alt={name}
          />
          <h3 className="dark:text-dark-100 mt-3 line-clamp-2 font-medium text-gray-800">
            {name}
          </h3>
          <p className="text-xs-plus">{time}</p>
          <div className="mt-2">
            <Tag href="#" color={color}>
              {category}
            </Tag>
          </div>
        </div>
        <div className="mt-10 flex justify-between">
          <div className="flex -space-x-2">
            {students.map((student) => (
              <Avatar
                size={7}
                key={student.uid}
                name={student.name}
                src={student.avatar}
                classNames={{
                  root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
                  display: "dark:ring-dark-700 text-xs ring-2 ring-white",
                }}
              />
            ))}
          </div>
          <Button className="size-7 rounded-full" isIcon>
            <ArrowUpRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
