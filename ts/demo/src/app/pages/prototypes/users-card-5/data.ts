export interface User {
  uid: string;
  name: string;
  avatar?: string | null;
  username: string;
  isOnline: boolean;
}

export const users: User[] = [
  {
    uid: "1",
    name: "Konnor Guzman",
    avatar: "/images/avatar/avatar-20.jpg",
    username: "@konnorguzman",
    isOnline: true,
  },
  {
    uid: "2",
    name: "Travis Fuller",
    avatar: "/images/avatar/avatar-19.jpg",
    username: "@travisfuller",
    isOnline: true,
  },
  {
    uid: "3",
    name: "Alfredo Elliott",
    avatar: "/images/avatar/avatar-18.jpg",
    username: "@alfredoelliott",
    isOnline: true,
  },
  {
    uid: "4",
    name: "Derrick Simmons",
    avatar: null,
    username: "@derricksimmons",
    isOnline: false,
  },
  {
    uid: "5",
    name: "Katrina West",
    avatar: "/images/avatar/avatar-11.jpg",
    username: "@katrinawest",
    isOnline: true,
  },
  {
    uid: "6",
    name: "Henry Curtis",
    avatar: "/images/avatar/avatar-4.jpg",
    username: "@henrycurtis",
    isOnline: true,
  },
  {
    uid: "7",
    name: "Raul Bradley",
    avatar: "/images/avatar/avatar-5.jpg",
    username: "@raulbradley",
    isOnline: true,
  },
  {
    uid: "8",
    name: "Samantha Shelton",
    avatar: null,
    username: "@samanthashelton",
    isOnline: true,
  },
  {
    uid: "9",
    name: "Corey Evans",
    avatar: "/images/avatar/avatar-6.jpg",
    username: "@coreyevans",
    isOnline: false,
  },
  {
    uid: "10",
    name: "Lance Tucker",
    avatar: null,
    username: "@lancetucker",
    isOnline: true,
  },
  {
    uid: "11",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-1.jpg",
    username: "@anthonyjensen",
    isOnline: true,
  },
  {
    uid: "12",
    name: "Anthony Jensen",
    avatar: "/images/avatar/avatar-2.jpg",
    username: "anthonyjensen",
    isOnline: false,
  },
  {
    uid: "13",
    name: "Konnor Guzman",
    avatar: "/images/avatar/avatar-20.jpg",
    username: "@konnorguzman",
    isOnline: true,
  },
  {
    uid: "14",
    name: "Travis Fuller",
    avatar: "/images/avatar/avatar-19.jpg",
    username: "@travisfuller",
    isOnline: true,
  },
  {
    uid: "15",
    name: "Alfredo Elliott",
    avatar: "/images/avatar/avatar-18.jpg",
    username: "@alfredoelliott",
    isOnline: true,
  },
  {
    uid: "16",
    name: "Derrick Simmons",
    avatar: null,
    username: "@derricksimmons",
    isOnline: false,
  },
  {
    uid: "17",
    name: "Katrina West",
    avatar: "/images/avatar/avatar-11.jpg",
    username: "@katrinawest",
    isOnline: true,
  },
  {
    uid: "18",
    name: "Henry Curtis",
    avatar: "/images/avatar/avatar-4.jpg",
    username: "@henrycurtis",
    isOnline: true,
  },
];
