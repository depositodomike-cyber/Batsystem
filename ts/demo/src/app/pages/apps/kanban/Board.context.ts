// Local Imports
import { createSafeContext } from "@/utils/createSafeContext";
import { ColorType } from '@/constants/app';
import { Board, Task, Priority } from './data';

interface CardEntry {
  element: HTMLElement;
  [key: string]: any;
}

interface ColumnEntry {
  element: HTMLElement;
  [key: string]: any;
}

// Define the context value shape
export interface BoardContextValue {
  // State
  boards: Board[];
  currentBoard?: Board;
  instanceId: symbol;
  
  // Registry methods
  registerCard: ({ cardId, entry }: { cardId: string; entry: CardEntry }) => () => void;
  registerColumn: ({ columnId, entry }: { columnId: string; entry: ColumnEntry }) => () => void;
  
  // Board actions
  setActiveBoardId: (boardId: string) => void;
  createBoard: (board: {
    name: string;
    isPrivate?: boolean;
    columns?: { name: string; color: ColorType }[];
  }) => void;
  updateBoard: (updatedBoard: {
    name: string;
    isPrivate?: boolean;
    columns: { id?: string; name: string; color: ColorType }[];
  }) => void;
  deleteBoard: (boardId: string) => void;
  
  // Column actions
  createColumn: (column: { name: string; slug: string; color: ColorType }) => void;
  updateColumn: (updatedColumn: { id: string; name: string; color: ColorType }) => void;
  deleteColumn: (columnId: string) => void;
  
  // Task actions
  createTask: (columnId: string, task: { title: string; priority?: Priority }) => void;
  updateTask: (taskId: string, updatedTask: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
}

export const [BoardContextProvider, useBoardContext] = createSafeContext<BoardContextValue>(
  'useBoardContext must be used within BoardProvider'
);
