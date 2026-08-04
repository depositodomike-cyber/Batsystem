// Import Dependencies
import { useCallback, useEffect, useMemo, useReducer, ReactNode } from "react";
import { toast } from "sonner";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";

// Local Imports
import {
  ACTIONS,
  ReorderTodoParams,
  TodoContextProvider,
  TodoContextType,
} from "./Todo.context";
import { randomId } from "@/utils/randomId";
import { stringToSlug } from "@/utils/stringToSlug";
import { fakeTodos, Todo } from "./data";
import { getItemRegistry, todoKey, isItemData } from "./utils";

// ----------------------------------------------------------------------

// Types
interface TodoState {
  todos: Todo[];
  searchQuery: string;
  error: string | null;
  isLoading?: boolean;
}

type TodoId = string;

interface TodoAction {
  type: string;
  payload: any;
}

interface UpdateTodoPayload {
  id: TodoId;
  updates: Partial<Todo>;
}

interface TogglePayload {
  id: TodoId;
  value: boolean;
}

interface ReorderPayload {
  startIndex: number;
  finishIndex: number;
}

const initialState: TodoState = {
  todos: fakeTodos,
  searchQuery: "",
  error: null,
};

// Reducer Handlers
const reducerHandlers = {
  [ACTIONS.SET_TODOS]: (state: TodoState, payload: Todo[]): TodoState => ({
    ...state,
    todos: payload,
    isLoading: false,
  }),

  [ACTIONS.CREATE_TODO]: (state: TodoState, payload: Todo): TodoState => ({
    ...state,
    todos: [payload, ...state.todos],
  }),

  [ACTIONS.UPDATE_TODO]: (
    state: TodoState,
    { id, updates }: UpdateTodoPayload,
  ): TodoState => ({
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === id ? { ...todo, ...updates } : todo,
    ),
  }),

  [ACTIONS.DELETE_TODO]: (state: TodoState, payload: TodoId): TodoState => ({
    ...state,
    todos: state.todos.filter((todo) => todo.id !== payload),
  }),

  [ACTIONS.TOGGLE_IMPORTANT]: (
    state: TodoState,
    { id, value }: TogglePayload,
  ): TodoState => ({
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === id ? { ...todo, isImportant: value } : todo,
    ),
  }),

  [ACTIONS.TOGGLE_DONE]: (
    state: TodoState,
    { id, value }: TogglePayload,
  ): TodoState => ({
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === id ? { ...todo, isDone: value } : todo,
    ),
  }),

  [ACTIONS.SET_SEARCH]: (state: TodoState, payload: string): TodoState => ({
    ...state,
    searchQuery: payload,
  }),

  [ACTIONS.REORDER_TODOS]: (
    state: TodoState,
    { startIndex, finishIndex }: ReorderPayload,
  ): TodoState => {
    const reorderedTodos = reorder({
      list: state.todos,
      startIndex,
      finishIndex,
    });

    return {
      ...state,
      todos: reorderedTodos,
    };
  },

  [ACTIONS.SET_ERROR]: (state: TodoState, payload: string): TodoState => ({
    ...state,
    error: payload,
    isLoading: false,
  }),
};

const registry = getItemRegistry();

const instanceId = () => Symbol("instance-id");

const todoReducer = (state: TodoState, action: TodoAction): TodoState => {
  const handler = reducerHandlers[action.type];
  return handler ? handler(state, action.payload) : state;
};

export function TodoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(todoReducer, initialState);
  const { todos, searchQuery, error } = state;

  const reorderTodo = useCallback(
    ({ startIndex, indexOfTarget, closestEdgeOfTarget }: ReorderTodoParams) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical",
      });

      if (finishIndex === startIndex) {
        return;
      }

      dispatch({
        type: ACTIONS.REORDER_TODOS,
        payload: { startIndex, finishIndex },
      });
    },
    [],
  );

  useEffect(() => {
    return monitorForElements({
      canMonitor({ source }) {
        return (
          isItemData(source.data, todoKey) &&
          source.data.instanceId === instanceId
        );
      },
      onDrop({ location, source }) {
        const target = location.current.dropTargets[0];

        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;

        if (
          !isItemData(sourceData, todoKey) ||
          !isItemData(targetData, todoKey)
        ) {
          return;
        }

        // Type assertion needed here as we've verified the data with isItemData
        const typedTargetData = targetData as { todo: Todo };
        const indexOfTarget = todos.findIndex(
          (todo) => todo.id === typedTargetData.todo.id,
        );

        if (indexOfTarget < 0) {
          return;
        }

        reorderTodo({
          startIndex: (sourceData as { index: number }).index,
          indexOfTarget,
          closestEdgeOfTarget: extractClosestEdge(targetData) as Edge | null,
        });
      },
    });
  }, [todos, reorderTodo]);

  const getListLength = useCallback(() => todos.length, [todos.length]);

  const createTodo: TodoContextType["createTodo"] = useCallback((todo) => {
    const newTodo: Todo = {
      ...(todo as any),

      id: randomId(),
      slug: stringToSlug(todo.title),
      createdAt: new Date().toISOString(),
      isDone: false,
      isImportant: false,
    };

    dispatch({ type: ACTIONS.CREATE_TODO, payload: newTodo });
    toast.success("Todo created successfully");
  }, []);

  const updateTodo: TodoContextType["updateTodo"] = useCallback(
    (todoId, updates) => {
      const updatedTodo = {
        ...updates,
        slug: updates.title ? stringToSlug(updates.title) : undefined,
        updatedAt: new Date().toISOString(),
      };

      dispatch({
        type: ACTIONS.UPDATE_TODO,
        payload: { id: todoId, updates: updatedTodo },
      });
      toast.success("Todo updated successfully");
    },
    [],
  );

  const deleteTodo: TodoContextType["deleteTodo"] = useCallback((todoId) => {
    dispatch({ type: ACTIONS.DELETE_TODO, payload: todoId });
    toast.success("Todo deleted successfully");
  }, []);

  const setIsImportant: TodoContextType["setIsImportant"] = useCallback(
    (todoId, value) => {
      dispatch({
        type: ACTIONS.TOGGLE_IMPORTANT,
        payload: { id: todoId, value },
      });
    },
    [],
  );

  const setIsDone: TodoContextType["setIsDone"] = useCallback(
    (todoId, value) => {
      dispatch({
        type: ACTIONS.TOGGLE_DONE,
        payload: { id: todoId, value },
      });
      if (value) toast.success("Todo marked as done");
    },
    [],
  );

  const setSearchQuery: TodoContextType["setSearchQuery"] = useCallback(
    (query) => {
      dispatch({ type: ACTIONS.SET_SEARCH, payload: query });
    },
    [],
  );

  const value = useMemo((): TodoContextType => {
    return {
      todos,
      registerTodo: registry.register,
      error,
      createTodo,
      updateTodo,
      deleteTodo,
      setIsImportant,
      setIsDone,
      setSearchQuery,
      searchQuery,
      reorderTodo,
      instanceId,
      getListLength,
    };
  }, [
    createTodo,
    deleteTodo,
    error,
    getListLength,
    reorderTodo,
    searchQuery,
    setIsDone,
    setIsImportant,
    setSearchQuery,
    todos,
    updateTodo,
  ]);

  return <TodoContextProvider value={value}>{children}</TodoContextProvider>;
}
