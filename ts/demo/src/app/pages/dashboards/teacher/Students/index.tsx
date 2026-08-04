// Local Imports
import { Student, StudentCard } from "./StudentCard";

// ----------------------------------------------------------------------

const students: Student[] = [
  {
    id: "1",
    name: "Travis Fuller",
    messagesCount: 4,
    avatar: "/images/avatar/avatar-20.jpg",
    isOnline: true,
    progress: 64,
  },
  {
    id: "2",
    name: "Konnor Guzman",
    messagesCount: 0,
    avatar: "/images/avatar/avatar-19.jpg",
    isOnline: false,
    progress: 78,
  },
  {
    id: "3",
    name: "Alfredo Elliott",
    messagesCount: 3,
    avatar: "/images/avatar/avatar-18.jpg",
    isOnline: false,
    progress: 43,
  },
  {
    id: "4",
    name: "Derrick Simmons",
    messagesCount: 0,
    avatar: undefined,
    isOnline: true,
    progress: 39,
  },
];

export function Students() {
  return (
    <div className="sm:col-span-2 lg:col-span-1">
      <div className="flex h-8 items-center justify-between">
        <h2 className="dark:text-dark-100 font-medium tracking-wide text-gray-800">
          Students
        </h2>
        <a
          href="##"
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          View All
        </a>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-1">
        {students.map((student) => (
          <StudentCard key={student.id} {...student} />
        ))}
      </div>
    </div>
  );
}
