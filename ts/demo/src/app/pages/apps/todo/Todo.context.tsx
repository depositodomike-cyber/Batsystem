// Local Imports
import { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import { createSafeContext } from "@/utils/createSafeContext";
import { Todo } from "./data";

type TodoId = string;

export interface ReorderTodoParams {
  startIndex: number;
  indexOfTarget: number;
  closestEdgeOfTarget: Edge | null;
}

export const ACTIONS = {
  SET_TODOS: "SET_TODOS",
  CREATE_TODO: "CREATE_TODO",
  UPDATE_TODO: "UPDATE_TODO",
  DELETE_TODO: "DELETE_TODO",
  TOGGLE_IMPORTANT: "TOGGLE_IMPORTANT",
  TOGGLE_DONE: "TOGGLE_DONE",
  SET_SEARCH: "SET_SEARCH",
  REORDER_TODOS: "REORDER_TODOS",
  SET_ERROR: "SET_ERROR",
};

export interface TodoContextType {
  todos: Todo[];
  registerTodo: (params: {
    itemId: string;
    element: HTMLElement;
  }) => () => void;
  error: string | null;
  createTodo: (todo: Partial<Todo> & { title: string }) => void;
  updateTodo: (todoId: TodoId, updates: Partial<Todo>) => void;
  deleteTodo: (todoId: TodoId) => void;
  setIsImportant: (todoId: TodoId, value: boolean) => void;
  setIsDone: (todoId: TodoId, value: boolean) => void;
  setSearchQuery: (query: string) => void;
  searchQuery: string;
  reorderTodo: (params: ReorderTodoParams) => void;
  instanceId: () => symbol;
  getListLength: () => number;
}

export const [TodoContextProvider, useTodoContext] =
  createSafeContext<TodoContextType>(
    "useTodoContext must be used within TodoProvider",
  );
