// Import Dependencies
import { COLORS, ColorType } from "@/constants/app";
import { FaCheckDouble, FaRegClock, FaSpinner } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { stringToSlug } from "@/utils/stringToSlug";

// ----------------------------------------------------------------------

export interface Member {
  uid: string;
  name: string;
  avatar?: string;
}

export interface Label {
  id: string;
  text: string;
  color: ColorType;
}

/** Prioridade de uma atividade (usada no filtro "Toda prioridade"). */
export type Priority = "alta" | "media" | "baixa";

export interface Task {
  id: string;
  title: string;
  slug: string;
  description?: string;
  cover?: string;
  status?: string;
  color?: ColorType;
  priority?: Priority;
  labels?: Label[];
  members?: Member[];
  attachmentsCount?: number;
  commentsCount?: number;
  dueDate?: Date;
}

export interface Column {
  id: string;
  name: string;
  slug: string;
  color: ColorType;
  Icon?: IconType;
  tasks: string[];
}

export interface Board {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
  columns: Column[];
  tasks: Task[];
}

// ----------------------------------------------------------------------
// Quadros padrão do beculture. Cada quadro nasce com as três etapas do fluxo
// ("A fazer", "Em andamento", "Concluído"). O helper distribui as atividades
// iniciais (se houver) nas etapas pelo slug.
// ----------------------------------------------------------------------

type ColSlug = "a-fazer" | "em-andamento" | "concluido";

const COLUMN_TEMPLATE: { name: string; slug: ColSlug; color: ColorType; Icon: IconType }[] = [
  { name: "A fazer", slug: "a-fazer", color: "info", Icon: FaRegClock },
  { name: "Em andamento", slug: "em-andamento", color: "warning", Icon: FaSpinner },
  { name: "Concluído", slug: "concluido", color: "success", Icon: FaCheckDouble },
];

function makeBoard(
  id: string,
  name: string,
  isPrivate: boolean,
  seed: { col: ColSlug; title: string }[],
): Board {
  const columns: Column[] = COLUMN_TEMPLATE.map((c, i) => ({
    id: `${id}-c${i}`,
    name: c.name,
    slug: c.slug,
    color: c.color,
    Icon: c.Icon,
    tasks: [],
  }));

  const tasks: Task[] = seed.map((t, i) => ({
    id: `${id}-t${i}`,
    title: t.title,
    slug: stringToSlug(t.title) || `${id}-t${i}`,
    status: t.col,
    color: "neutral",
    labels: [],
    members: [],
    commentsCount: 0,
    attachmentsCount: 0,
  }));

  seed.forEach((t, i) => {
    const col = columns.find((c) => c.slug === t.col);
    if (col) col.tasks.push(`${id}-t${i}`);
  });

  return { id, name, slug: stringToSlug(name) || id, isPrivate, columns, tasks };
}

export const fakeBoards: Board[] = [
  makeBoard("b-meu", "Meu quadro", false, []),
  makeBoard("b-dados", "Dados", false, [
    { col: "a-fazer", title: "Mapear fontes de dados" },
    { col: "a-fazer", title: "Definir dicionário de dados" },
    { col: "em-andamento", title: "Pipeline de ingestão" },
    { col: "concluido", title: "Modelo de dados aprovado" },
  ]),
  makeBoard("b-neotrust", "Neotrust", false, [
    { col: "a-fazer", title: "Levantar requisitos" },
    { col: "em-andamento", title: "Integração da API" },
  ]),
  makeBoard("b-beculture", "beculture", false, []),
];

export const allMembers: Member[] = [
  {
    uid: "1",
    name: "John Doe",
    avatar: undefined,
  },
  {
    uid: "2",
    name: "Emilia Clarke",
    avatar: "/images/avatar/avatar-11.jpg",
  },
  {
    uid: "3",
    name: "Majid Yahyaei",
    avatar: "/images/avatar/avatar-20.jpg",
  },
  {
    uid: "4",
    name: "Travis Fuller",
    avatar: undefined,
  },
  {
    uid: "5",
    name: "Alfredo Elliott",
    avatar: "/images/avatar/avatar-4.jpg",
  },
  {
    uid: "6",
    name: "Henry Curtis",
    avatar: undefined,
  },
  {
    uid: "10",
    name: "Lance Tucker",
    avatar: "/images/avatar/avatar-18.jpg",
  },
  {
    uid: "11",
    name: "Katrina West",
    avatar: "/images/avatar/avatar-11.jpg",
  },
  {
    uid: "12",
    name: "Samantha Shelton",
    avatar: "/images/avatar/avatar-11.jpg",
  },
  {
    uid: "13",
    name: "Corey Evans",
    avatar: "/images/avatar/avatar-1.jpg",
  },
  {
    uid: "14",
    name: "Joe Perkins",
    avatar: "/images/avatar/avatar-5.jpg",
  },
  {
    uid: "15",
    name: "Henry Cavil",
    avatar: undefined,
  },
];

export const labels: Label[] = [
  {
    id: "1",
    color: "secondary",
    text: "Update",
  },
  {
    id: "2",
    color: "primary",
    text: "Create",
  },
  {
    id: "3",
    color: "success",
    text: "Improve",
  },
  {
    id: "4",
    text: "Feature",
    color: "warning",
  },
  {
    id: "5",
    color: "primary",
    text: "Support",
  },
  {
    id: "6",
    color: "error",
    text: "Performance",
  },
  {
    id: "7",
    color: "info",
    text: "Blog",
  },
  {
    id: "8",
    color: "warning",
    text: "Weekly",
  },
  {
    id: "9",
    color: "info",
    text: "Daily",
  },
];

export const colors = COLORS;
