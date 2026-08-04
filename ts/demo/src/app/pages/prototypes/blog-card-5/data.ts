// Types for Blog Card 5
import { ComponentType } from "react";
import {
  CpuChipIcon,
  CurrencyDollarIcon,
  HomeIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/outline";

export interface Post {
  uid: string;
  cover: string;
  category: string;
  CategoryIcon: ComponentType<any>;
  title: string;
  created_at: string;
}

export const posts: Post[] = [
  {
    uid: "1",
    cover: "/images/objects/object-2.jpg",
    category: "Technology",
    CategoryIcon: CpuChipIcon,
    title: "10 Tips for Making a Good Camera Even Better",
    created_at: "48 min ago",
  },
  {
    uid: "2",
    cover: "/images/objects/object-3.jpg",
    category: "Music",
    CategoryIcon: MusicalNoteIcon,
    title: "How Did We Get Here? The History of Music Told Through Tweets",
    created_at: "a hour ago",
  },
  {
    uid: "3",
    cover: "/images/objects/object-4.jpg",
    category: "Business",
    CategoryIcon: CurrencyDollarIcon,
    title: "The 12 Worst Types Business Accounts You Follow on Twitter",
    created_at: "a day ago",
  },
  {
    uid: "4",
    cover: "/images/objects/object-9.jpg",
    category: "Home",
    CategoryIcon: HomeIcon,
    title: "25 Surprising Facts About Chair",
    created_at: "3 days ago",
  },
  {
    uid: "5",
    cover: "/images/objects/object-8.jpg",
    category: "Home",
    CategoryIcon: HomeIcon,
    title: "10 Meetups About Food You Should Attend",
    created_at: "5 days ago",
  },
  {
    uid: "6",
    cover: "/images/objects/object-7.jpg",
    category: "Home",
    CategoryIcon: HomeIcon,
    title: "Food: A Simple Definition",
    created_at: "8 days ago",
  },
  {
    uid: "7",
    cover: "/images/objects/object-19.jpg",
    category: "Technology",
    CategoryIcon: CpuChipIcon,
    title: "10 Tips for Making a Good Camera Even Better",
    created_at: "48 min ago",
  },
  {
    uid: "8",
    cover: "/images/objects/object-15.jpg",
    category: "Music",
    CategoryIcon: MusicalNoteIcon,
    title: "How Did We Get Here? The History of Music Told Through Tweets",
    created_at: "a hour ago",
  },
  {
    uid: "9",
    cover: "/images/objects/object-16.jpg",
    category: "Business",
    CategoryIcon: CurrencyDollarIcon,
    title: "The 12 Worst Types Business Accounts You Follow on Twitter",
    created_at: "a day ago",
  },
];
