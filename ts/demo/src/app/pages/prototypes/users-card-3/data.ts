export interface User {
  uid: string;
  name: string;
  avatar?: string | null;
  tags: string[];
}

export const users: User[] = [
  {
    uid: "1",
    name: "Konnor Guzman",
    avatar: "/images/avatar/avatar-20.jpg",
    tags: ["PHP", "NodeJS", "ReactJS"],
  },
  {
    uid: "2",
    name: "Travis Fuller",
    avatar: "/images/avatar/avatar-19.jpg",
    tags: ["React", "Laravel"],
  },
  {
    uid: "3",
    name: "Alfredo Elliott",
    avatar: "/images/avatar/avatar-18.jpg",
    tags: ["Javascript", "CSS", "ES6"],
  },
  {
    uid: "4",
    name: "Derrick Simmons",
    avatar: null,
    tags: ["AlpineJS", "TailwindCSS"],
  },
  {
    uid: "5",
    name: "Katrina West",
    avatar: "/images/avatar/avatar-11.jpg",
    tags: ["Ionic", "React", "Flutter"],
  },
  {
    uid: "6",
    name: "Henry Curtis",
    avatar: "/images/avatar/avatar-4.jpg",
    tags: ["ReactJS", "Typescript", "NestJS"],
  },
  {
    uid: "7",
    name: "Raul Bradley",
    avatar: "/images/avatar/avatar-5.jpg",
    tags: ["MariaDB", "Laravel"],
  },
  {
    uid: "8",
    name: "Samantha Shelton",
    avatar: null,
    tags: ["MariaDB", "Laravel"],
  },
  {
    uid: "9",
    name: "Corey Evans",
    avatar: "/images/avatar/avatar-6.jpg",
    tags: ["SolidJS", "ReactJS", "Typescript"],
  },
  {
    uid: "10",
    name: "Lance Tucker",
    avatar: null,
    tags: ["NestJS", "Express", "Typescript"],
  },
  {
    uid: "11",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-1.jpg",
    tags: ["Figma", "Illustrator", "Sketch"],
  },
  {
    uid: "12",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-2.jpg",
    tags: ["NextJS", "Remix", "Typescript"],
  },
];
