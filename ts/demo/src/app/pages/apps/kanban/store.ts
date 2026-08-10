// Persistência compartilhada dos quadros do Kanban.
// ----------------------------------------------------------------------
// O Kanban do template guardava os quadros só em memória (fakeBoards),
// reiniciando a cada reload e sem acesso fora da rota /kanban. Este módulo
// centraliza a leitura/escrita dos quadros no localStorage, permitindo que:
//   1. o Kanban persista o estado entre sessões (BoardProvider hidrata daqui);
//   2. outras telas (ex.: To Do do Painel) leiam os quadros/etapas e criem
//      atividades diretamente numa etapa — como fazia o widget do beculture.
//
// Observações de serialização:
//   • Column.Icon é um componente React (não serializável) — o JSON.stringify
//     o descarta; a UI da coluna já trata Icon como opcional. Reanexamos os
//     ícones padrão por slug ao hidratar, para os quadros de exemplo.
//   • Task.dueDate vira string no JSON; a UI usa dayjs(dueDate), que aceita
//     string, então não é necessário reviver.
// ----------------------------------------------------------------------

import { FaCheckDouble, FaRegClock, FaSpinner } from "react-icons/fa6";
import type { IconType } from "react-icons";

import { randomId } from "@/utils/randomId";
import { stringToSlug } from "@/utils/stringToSlug";
import { chaveConta, lerComMigracao } from "@/utils/escopoConta";
import { Board, Column, Task, fakeBoards } from "./data";

export const KANBAN_STORAGE_BASE = "ceo-kanban-boards-v2";
/** @deprecated use KANBAN_STORAGE_BASE + chaveConta */
export const KANBAN_STORAGE_KEY = KANBAN_STORAGE_BASE;

function storageKey(): string {
  return chaveConta(KANBAN_STORAGE_BASE);
}

// Ícones padrão das etapas, reanexados por slug após o JSON round-trip
// (Column.Icon é um componente e não sobrevive à serialização).
const DEFAULT_COLUMN_ICONS: Record<string, IconType> = {
  "a-fazer": FaRegClock,
  "em-andamento": FaSpinner,
  concluido: FaCheckDouble,
};

function reattachIcons(boards: Board[]): Board[] {
  return boards.map((b) => ({
    ...b,
    columns: b.columns.map((c) =>
      c.Icon ? c : { ...c, Icon: DEFAULT_COLUMN_ICONS[c.slug] },
    ),
  }));
}

/** Lê os quadros do localStorage; na ausência, devolve os quadros de exemplo. */
export function loadBoards(): Board[] {
  if (typeof window === "undefined") return fakeBoards;
  try {
    const raw = lerComMigracao(KANBAN_STORAGE_BASE);
    if (!raw) return fakeBoards;
    const parsed = JSON.parse(raw) as Board[];
    if (!Array.isArray(parsed)) return fakeBoards;
    return reattachIcons(parsed);
  } catch {
    return fakeBoards;
  }
}

/** Persiste os quadros no localStorage (Icons são descartados pelo JSON). */
export function saveBoards(boards: Board[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(boards));
  } catch {
    /* ignora indisponibilidade de storage */
  }
}

// ---- Leitura leve para menus externos (ex.: To Do → "enviar para etapa") ----

export interface BoardLite {
  id: string;
  name: string;
  columns: { id: string; name: string; color: string }[];
}

/** Lista os quadros e suas etapas num formato enxuto para menus. */
export function listBoards(): BoardLite[] {
  return loadBoards().map((b) => ({
    id: b.id,
    name: b.name,
    columns: b.columns.map((c) => ({ id: c.id, name: c.name, color: c.color })),
  }));
}

/**
 * Cria uma atividade com o título informado dentro de uma etapa de um quadro e
 * persiste. Devolve os nomes do quadro e da etapa (para feedback ao usuário).
 * Lança se o quadro/etapa não existir mais.
 */
export function sendTaskToColumn(
  boardId: string,
  columnId: string,
  title: string,
): { board: string; column: string } {
  const boards = loadBoards();
  const board = boards.find((b) => b.id === boardId);
  if (!board) throw new Error("Quadro não encontrado.");
  const column = board.columns.find((c: Column) => c.id === columnId);
  if (!column) throw new Error("Etapa não encontrada.");

  const newTask: Task = {
    id: randomId(),
    title,
    slug: stringToSlug(title) || randomId(),
    description: "",
    status: column.slug,
    color: "neutral",
    labels: [],
    members: [],
    commentsCount: 0,
    attachmentsCount: 0,
  };

  const updated = boards.map((b) =>
    b.id !== boardId
      ? b
      : {
          ...b,
          tasks: [...b.tasks, newTask],
          columns: b.columns.map((c) =>
            c.id === columnId ? { ...c, tasks: [...c.tasks, newTask.id] } : c,
          ),
        },
  );

  saveBoards(updated);
  return { board: board.name, column: column.name };
}
