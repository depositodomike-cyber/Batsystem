// Local Imports
import { Class, ClassCard } from "./ClassCard";
import React from "react";

// ----------------------------------------------------------------------

const classes: Class[] = [
  {
    id: "1",
    image: "/images/technology/sales-presentation-sm.jpg",
    name: "Basic English",
    category: "Language",
    time: "Mon. 08:00 - 09:00",
    color: "primary",
    students: [
      {
        uid: "5",
        name: "Katrina West",
        avatar: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "6",
        name: "Henry Curtis",
        avatar: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "7",
        name: "Raul Bradley",
        avatar: "/images/avatar/avatar-5.jpg",
      },
    ],
  },
  {
    id: "2",
    image: "/images/technology/design-sm.jpg",
    name: "Learn UI/UX Design",
    category: "UI/UX Design",
    time: "Tue. 10:00 - 11:30",
    color: "info",
    students: [
      {
        uid: "8",
        name: "Samantha Shelton",
        avatar: undefined,
      },
      {
        uid: "9",
        name: "Corey Evans",
        avatar: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "10",
        name: "Lance Tucker",
        avatar: undefined,
      },
    ],
  },
  {
    id: "3",
    image: "/images/technology/dashboard.jpg",
    name: "Basic of digital marketing",
    category: "Marketing",
    time: "Wed. 09:00 - 11:00",
    color: "secondary",
    students: [
      {
        uid: "6",
        name: "Henry Curtis",
        avatar: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "7",
        name: "Raul Bradley",
        avatar: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "8",
        name: "Samantha Shelton",
        avatar: undefined,
      },
    ],
  },
];

export function Classes(): React.ReactElement {
  return (
    <div className="mt-4 sm:mt-5 lg:mt-6">
      <div className="flex h-8 min-w-0 items-center justify-between">
        <h2 className="dark:text-dark-100 truncate text-base font-medium tracking-wide text-gray-800">
          Week 2 Classes
        </h2>
        <a
          href="##"
          className="text-xs-plus text-primary-600 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70 border-b border-dotted border-current pb-0.5 font-medium outline-hidden transition-colors duration-300"
        >
          View All
        </a>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {classes.map((item) => (
          <ClassCard key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
}
