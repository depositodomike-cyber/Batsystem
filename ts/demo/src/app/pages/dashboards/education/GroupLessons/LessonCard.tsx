// Import Dependencies
import { ArrowUpRightIcon, CalendarIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

interface Student {
  uid: string;
  name: string;
  avatar?: string;
}

export interface Lesson {
  id: string;
  name: string;
  description: string;
  date: string;
  students: Student[];
}

export function LessonCard({ name, description, date, students }: Lesson) {
  return (
    <Card className="p-4">
      <h5 className="dark:text-dark-100 line-clamp-2 font-medium text-gray-800">
        {name}
      </h5>
      <p className="text-xs-plus mt-1 line-clamp-2">{description}</p>
      <div className="mt-4 flex -space-x-2">
        {students.map((student) => (
          <Avatar
            key={student.uid}
            size={7}
            classNames={{
              root: "origin-bottom transition-transform hover:z-10 hover:scale-125",
              display: "dark:ring-dark-700 text-xs ring-2 ring-white",
            }}
            name={student.name}
            src={student.avatar}
            initialColor="auto"
          />
        ))}
      </div>

      <div className="mt-2 flex items-end justify-between">
        <div className="dark:text-dark-300 flex items-center gap-2 text-gray-400">
          <CalendarIcon className="size-4.5" />
          <span className="text-xs">{date}</span>
        </div>
        <Button className="size-7 rounded-full" isIcon>
          <ArrowUpRightIcon className="size-3.5" />
        </Button>
      </div>
    </Card>
  );
}
