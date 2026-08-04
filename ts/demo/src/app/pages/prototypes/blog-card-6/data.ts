export interface Post {
  uid: string;
  cover: string;
  title: string;
  readTime: string;
  author: {
    name: string;
    avatar?: string | null;
  };
}

export const posts: Post[] = [
  {
    uid: "1",
    cover: "/images/objects/object-2.jpg",
    title: "What is Tailwind CSS?",
    readTime: "2 min read",
    author: {
      name: "John D.",
      avatar: "/images/avatar/avatar-20.jpg",
    },
  },
  {
    uid: "2",
    cover: "/images/objects/object-1.jpg",
    title: "Tailwind CSS Card Example",
    readTime: "5 min read",
    author: {
      name: "Travis F.",
      avatar: "/images/avatar/avatar-19.jpg",
    },
  },
  {
    uid: "3",
    cover: "/images/objects/object-3.jpg",
    title: "10 Tips for Making a Good Camera Even Better",
    readTime: "4 min read",
    author: {
      name: "Alfredo E.",
      avatar: "/images/avatar/avatar-18.jpg",
    },
  },
  {
    uid: "4",
    cover: "/images/objects/object-4.jpg",
    title: "Top Design Systems",
    readTime: "1 min read",
    author: {
      name: "Katrina W.",
      avatar: "/images/avatar/avatar-11.jpg",
    },
  },
  {
    uid: "5",
    cover: "/images/objects/object-5.jpg",
    title: "NodeJS Design Patterns",
    readTime: "6 min read",
    author: {
      name: "Henry C.",
      avatar: null,
    },
  },
  {
    uid: "6",
    cover: "/images/objects/object-6.jpg",
    title: "313 Pattern and Color ideas",
    readTime: "3 min read",
    author: {
      name: "Derrick S.",
      avatar: "/images/avatar/avatar-5.jpg",
    },
  },
  {
    uid: "7",
    cover: "/images/objects/object-7.jpg",
    title: "10 Tips for Making a Good Camera Even Better",
    readTime: "1 min read",
    author: {
      name: "Raul B.",
      avatar: null,
    },
  },
  {
    uid: "8",
    cover: "/images/objects/object-8.jpg",
    title: "The 12 Worst Types Business Accounts You Follow on Twitter",
    readTime: "7 min read",
    author: {
      name: "Samantha S.",
      avatar: "/images/avatar/avatar-20.jpg",
    },
  },
  {
    uid: "9",
    cover: "/images/objects/object-9.jpg",
    title: "25 Surprising Facts About Chair",
    readTime: "2 min read",
    author: {
      name: "Travis F.",
      avatar: "/images/avatar/avatar-19.jpg",
    },
  },
  {
    uid: "10",
    cover: "/images/objects/object-14.jpg",
    title: "What is Tailwind CSS?",
    readTime: "2 min read",
    author: {
      name: "John D.",
      avatar: "/images/avatar/avatar-20.jpg",
    },
  },
  {
    uid: "11",
    cover: "/images/objects/object-10.jpg",
    title: "Tailwind CSS Card Example",
    readTime: "5 min read",
    author: {
      name: "Travis F.",
      avatar: "/images/avatar/avatar-19.jpg",
    },
  },
  {
    uid: "12",
    cover: "/images/objects/object-12.jpg",
    title: "10 Tips for Making a Good Camera Even Better",
    readTime: "4 min read",
    author: {
      name: "Alfredo E.",
      avatar: "/images/avatar/avatar-18.jpg",
    },
  },
];
