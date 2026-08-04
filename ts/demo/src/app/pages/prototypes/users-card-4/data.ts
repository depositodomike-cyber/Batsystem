export interface User {
  uid: string;
  name: string;
  avatar?: string | null;
  position: string;
}

export const users: User[] = [
  {
    uid: "1",
    name: "Konnor Guzman",
    avatar: "/images/avatar/avatar-20.jpg",
    position: "Senior Developer",
  },
  {
    uid: "2",
    name: "Travis Fuller",
    avatar: "/images/avatar/avatar-19.jpg",
    position: "Web Developer",
  },
  {
    uid: "3",
    name: "Alfredo Elliott",
    avatar: "/images/avatar/avatar-18.jpg",
    position: "UI/UX designer",
  },
  {
    uid: "4",
    name: "Derrick Simmons",
    avatar: null,
    position: "React Developer",
  },
  {
    uid: "5",
    name: "Katrina West",
    avatar: "/images/avatar/avatar-11.jpg",
    position: "Android Developer",
  },
  {
    uid: "6",
    name: "Henry Curtis",
    avatar: "/images/avatar/avatar-4.jpg",
    position: "Full Stack Developer",
  },
  {
    uid: "7",
    name: "Raul Bradley",
    avatar: "/images/avatar/avatar-5.jpg",
    position: "Laravel Developer",
  },
  {
    uid: "8",
    name: "Samantha Shelton",
    avatar: null,
    position: "Backend Developer",
  },
  {
    uid: "9",
    name: "Corey Evans",
    avatar: "/images/avatar/avatar-6.jpg",
    position: "Frontend Developer",
  },
  {
    uid: "10",
    name: "Lance Tucker",
    avatar: null,
    position: "NodeJS Developer",
  },
  {
    uid: "11",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-1.jpg",
    position: "UI/UX Designer",
  },
  {
    uid: "12",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-2.jpg",
    position: "Backend Developer",
  },
];
