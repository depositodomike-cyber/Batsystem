export interface Post {
  uid: string;
  cover: string;
  category: string;
  title: string;
  description: string;
  author: {
    uid: string;
    avatar?: string;
    name: string;
    username: string;
  };
  tags: string[];
  viewCount: number;
  created_at: string;
}

export const posts: Post[] = [
  {
    uid: "1",
    cover: "/images/objects/object-6.jpg",
    category: "Frameworks",
    title: "What is Tailwind CSS?",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eveniet, provident quasi recusandae repudiandae rerum temporibus!",
    author: {
      uid: "1",
      avatar: "/images/avatar/avatar-10.jpg",
      name: "John Doe",
      username: "@johndoe",
    },
    tags: ["PHP", "ReactJS", "NextJS"],
    viewCount: 237,
    created_at: "37 min ago",
  },
  {
    uid: "2",
    cover: "/images/objects/object-3.jpg",
    category: "Frameworks",
    title: "Tailwind CSS Card Example",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Est repellat nisi corrupti. Lorem, ipsum.",
    author: {
      uid: "2",
      avatar: "/images/avatar/avatar-2.jpg",
      name: "Konnor Guzman",
      username: "@konnorguzman",
    },
    tags: ["TailwindCSS", "RemixJS", "AlpineJS"],
    viewCount: 479,
    created_at: "2 hour ago",
  },
  {
    uid: "3",
    cover: "/images/objects/object-4.jpg",
    category: "Programming Language",
    title: "What is PHP?",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eveniet, provident quasi recusandae repudiandae rerum temporibus!",
    author: {
      uid: "3",
      avatar: "/images/avatar/avatar-1.jpg",
      name: "Travis Fuller",
      username: "@travisfuller",
    },
    tags: ["OOP", "Laravel", "NextJS"],
    viewCount: 665,
    created_at: "2 days ago",
  },
  {
    uid: "4",
    cover: "/images/objects/object-7.jpg",
    category: "UI/UX",
    title: "Top Design Systems",
    description:
      "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quidem quibusdam, ipsam in eveniet quod voluptatum!",
    author: {
      uid: "4",
      avatar: "/images/avatar/avatar-20.jpg",
      name: "Alfredo Elliott",
      username: "@alfredorlliott",
    },
    tags: ["DesignSystem", "MaterialUI", "FluentDesign"],
    viewCount: 742,
    created_at: "3 days ago",
  },
  {
    uid: "5",
    cover: "/images/objects/object-5.jpg",
    category: "UI/UX",
    title: "313 Pattern and Color ideas",
    description:
      "Lorem, ipsum dolor sit amet consectetur adipisicing elit. Voluptates impedit odio consectetur! Voluptatem ipsa nulla excepturi voluptatibus.",
    author: {
      uid: "5",
      avatar: "/images/avatar/avatar-19.jpg",
      name: "Derrick Simmons",
      username: "@derricksimmons",
    },
    tags: ["colors", "spectrum", "warmcolors"],
    viewCount: 23,
    created_at: "6 days ago",
  },
  {
    uid: "6",
    cover: "/images/objects/object-5.jpg",
    category: "Programming Language",
    title: "NodeJS Design Patterns",
    description:
      "Lorem ipsum dolor sit amet consectetur, adipisicing elit. Alias rerum aliquam maiores dolorum itaque?",
    author: {
      uid: "6",
      avatar: "/images/avatar/avatar-11.jpg",
      name: "Katrina West",
      username: "@katrinawest",
    },
    tags: ["PHP", "NodeJS", "Javascript"],
    viewCount: 237,
    created_at: "14 days ago",
  },
];
