import { MaskType } from "@/@types/common";
import { ColorType } from "@/constants/app";

export interface User {
  uid: string;
  name: string;
  avatar?: string | null;
  position: string;
  skills: string[];
  color: ColorType;
  shape: MaskType;
}

export const users: User[] = [
  {
    uid: "1",
    name: "Konnor Guzman",
    avatar: "/images/avatar/avatar-20.jpg",
    position: "Senior Developer",
    skills: ["PHP", "NodeJS", "ReactJS"],
    color: "success",
    shape: "circle",
  },
  {
    uid: "2",
    name: "Travis Fuller",
    avatar: "/images/avatar/avatar-19.jpg",
    position: "Web Developer",
    skills: ["React", "Laravel"],
    color: "primary",
    shape: "circle",
  },
  {
    uid: "3",
    name: "Alfredo Elliott",
    avatar: "/images/avatar/avatar-18.jpg",
    position: "UI/UX designer",
    skills: ["Javascript", "CSS", "ES6"],
    color: "secondary",
    shape: "squircle",
  },
  {
    uid: "4",
    name: "Derrick Simmons",
    avatar: null,
    position: "React Developer",
    skills: ["AlpineJS", "TailwindCSS"],
    color: "warning",
    shape: "circle",
  },
  {
    uid: "5",
    name: "Katrina West",
    avatar: "/images/avatar/avatar-11.jpg",
    position: "Android Developer",
    skills: ["Ionic", "React", "Flutter"],
    color: "info",
    shape: "triangle",
  },
  {
    uid: "6",
    name: "Henry Curtis",
    avatar: "/images/avatar/avatar-4.jpg",
    position: "Full Stack Developer",
    skills: ["ReactJS", "Typescript", "NestJS"],
    color: "success",
    shape: "circle",
  },
  {
    uid: "7",
    name: "Raul Bradley",
    avatar: "/images/avatar/avatar-5.jpg",
    position: "Laravel Developer",
    skills: ["MariaDB", "Laravel"],
    color: "error",
    shape: "diamond",
  },
  {
    uid: "8",
    name: "Samantha Shelton",
    avatar: null,
    position: "Backend Developer",
    skills: ["MariaDB", "Laravel"],
    color: "primary",
    shape: "hexagon",
  },
  {
    uid: "9",
    name: "Corey Evans",
    avatar: "/images/avatar/avatar-6.jpg",
    position: "Frontend Developer",
    skills: ["SolidJS", "ReactJS", "Typescript"],
    color: "secondary",
    shape: "hexagon2",
  },
  {
    uid: "10",
    name: "Lance Tucker",
    avatar: null,
    position: "NodeJS Developer",
    skills: ["NestJS", "Express", "Typescript"],
    color: "warning",
    shape: "star",
  },
  {
    uid: "11",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-1.jpg",
    position: "UI/UX Designer",
    skills: ["Figma", "Illustrator", "Sketch"],
    color: "info",
    shape: "star2",
  },
  {
    uid: "12",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-2.jpg",
    position: "Backend Developer",
    skills: ["NextJS", "Remix", "Typescript"],
    color: "success",
    shape: "octagon",
  },
];
