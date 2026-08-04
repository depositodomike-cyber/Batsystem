// Import Dependencies
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import invariant from "tiny-invariant";
import { Board, Column, Task } from "./data";
import { ColorType } from "@/constants/app";

// Local Imports
import { BoardContextProvider, BoardContextValue } from "./Board.context";
import { randomId } from "@/utils/randomId";
import { stringToSlug } from "@/utils/stringToSlug";
import { triggerPostMoveFlash } from "@/utils/dom/triggerPostMoveFlash";
import { createRegistry } from "./utils";
import { loadBoards, saveBoards } from "./store";

// ----------------------------------------------------------------------

interface State {
  boards: Board[];
  activeBoardId: string | null;
  lastMoved: {
    trigger: "keyboard" | "pointer";
    outcome: {
      type: string;
      cardId?: string;
      columnId?: string;
      startIndex?: number;
      finishIndex?: number;
      startColumnId?: string;
      finishColumnId?: string;
      itemIndexInStartColumn?: number;
      itemIndexInFinishColumn?: number;
    };
  } | null;
}

// Estado inicial hidratado do localStorage (via store), com fallback nos
// quadros de exemplo. Calculado sob demanda para ler o storage no mount.
function createInitialState(): State {
  const boards = loadBoards();
  return {
    boards,
    activeBoardId: boards?.[0]?.id || null,
    lastMoved: null,
  };
}

const ACTIONS = {
  SET_ACTIVE_BOARD: "SET_ACTIVE_BOARD",
  CREATE_BOARD: "CREATE_BOARD",
  DELETE_BOARD: "DELETE_BOARD",
  UPDATE_BOARD: "UPDATE_BOARD",
  CREATE_COLUMN: "CREATE_COLUMN",
  DELETE_COLUMN: "DELETE_COLUMN",
  UPDATE_COLUMN: "UPDATE_COLUMN",
  CREATE_TASK: "CREATE_TASK",
  DELETE_TASK: "DELETE_TASK",
  UPDATE_TASK: "UPDATE_TASK",
  REORDER_TASK: "REORDER_TASK",
  MOVE_TASK: "MOVE_TASK",
  REORDER_COLUMN: "REORDER_COLUMN",
};

type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];

const reducerHandlers = {
  [ACTIONS.SET_ACTIVE_BOARD]: (state: State, payload: string): State => ({
    ...state,
    activeBoardId: payload,
  }),

  [ACTIONS.CREATE_BOARD]: (
    state: State,
    payload: Parameters<BoardContextValue["createBoard"]>[0],
  ): State => {
    const newColumns =
      payload.columns?.filter(Boolean).map((column) => ({
        id: randomId(),
        name: column.name,
        slug: stringToSlug(column.name),
        color: column.color,
        tasks: [],
      })) || [];

    const newBoard: Board = {
      id: randomId(),
      name: payload.name,
      isPrivate: !!payload.isPrivate,
      columns: newColumns,
      tasks: [],
      slug: stringToSlug(payload.name),
    };

    return {
      ...state,
      boards: [...state.boards, newBoard],
      activeBoardId: newBoard.id,
    };
  },

  [ACTIONS.DELETE_BOARD]: (
    state: State,
    payload: Parameters<BoardContextValue["deleteBoard"]>[0],
  ): State => {
    const restBoards = state.boards.filter(
      (board: Board) => board.id !== payload,
    );
    return {
      ...state,
      boards: restBoards,
      activeBoardId: restBoards[0]?.id || null,
    };
  },

  [ACTIONS.UPDATE_BOARD]: (
    state: State,
    payload: Parameters<BoardContextValue["updateBoard"]>[0],
  ): State => {
    const currentBoard = state.boards.find(
      (board: Board) => board.id === state.activeBoardId,
    );

    if (!currentBoard) return state;

    const updatedColumns = payload.columns.map(
      (column: { id?: string; name: string; color: ColorType }) => {
        if (column.id) {
          const colData = currentBoard.columns.find(
            (c: Column) => c.id === column.id,
          );
          if (!colData) {
            // If column not found, create a new one
            return {
              id: randomId(),
              name: column.name,
              slug: stringToSlug(column.name),
              color: column.color,
              tasks: [],
            };
          }
          return {
            ...colData,
            name: column.name,
            slug: stringToSlug(column.name),
            color: column.color,
          };
        }

        return {
          id: randomId(),
          name: column.name,
          slug: stringToSlug(column.name),
          color: column.color,
          tasks: [],
        };
      },
    );

    const updatedBoards = state.boards.map((board: Board) =>
      board.id === state.activeBoardId
        ? {
            ...board,
            name: payload.name,
            isPrivate: !!payload.isPrivate,
            columns: updatedColumns,
          }
        : board,
    );

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.CREATE_COLUMN]: (
    state: State,
    payload: Parameters<BoardContextValue["createColumn"]>[0],
  ): State => {
    const newColumn: Column = {
      ...payload,
      id: randomId(),
      tasks: [],
    };

    const updatedBoards = state.boards.map((board: Board) =>
      board.id === state.activeBoardId
        ? { ...board, columns: [...board.columns, newColumn] }
        : board,
    );

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.DELETE_COLUMN]: (
    state: State,
    payload: Parameters<BoardContextValue["deleteColumn"]>[0],
  ): State => {
    const updatedBoards = state.boards.map((board: Board) =>
      board.id === state.activeBoardId
        ? {
            ...board,
            columns: board.columns.filter(
              (column: Column) => column.id !== payload,
            ),
          }
        : board,
    );

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.UPDATE_COLUMN]: (
    state: State,
    payload: Parameters<BoardContextValue["updateColumn"]>[0],
  ): State => {
    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const updatedColumns = board.columns.map((column: Column) =>
        column.id === payload.id
          ? {
              ...column,
              name: payload.name,
              slug: stringToSlug(payload.name),
              color: payload.color,
            }
          : column,
      );
      return { ...board, columns: updatedColumns };
    });

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.CREATE_TASK]: (
    state: State,
    payload: Parameters<BoardContextValue["createTask"]>,
  ): State => {
    const [columnId, task] = payload;

    const currentBoard = state.boards.find(
      (board: Board) => board.id === state.activeBoardId,
    );

    if (!currentBoard) return state;

    const column = currentBoard.columns.find(
      (col: Column) => col.id === columnId,
    );

    if (!column) return state;

    const newTask: Task = {
      id: randomId(),
      title: task.title,
      slug: stringToSlug(task.title),
      description: "",
      status: column.slug,
      color: "neutral",
      priority: task.priority,
      labels: [],
      members: [],
      commentsCount: 0,
      attachmentsCount: 0,
    };

    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const updatedColumns = board.columns.map((col: Column) =>
        col.id === columnId
          ? { ...col, tasks: [...col.tasks, newTask.id] }
          : col,
      );

      return {
        ...board,
        tasks: [...board.tasks, newTask],
        columns: updatedColumns,
      };
    });

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.DELETE_TASK]: (
    state: State,
    payload: Parameters<BoardContextValue["deleteTask"]>[0],
  ): State => {
    const currentBoard = state.boards.find(
      (board: Board) => board.id === state.activeBoardId,
    );

    if (!currentBoard) return state;

    const taskToDelete = currentBoard.tasks.find(
      (task: Task) => task.id === payload,
    );

    if (!taskToDelete) return state;

    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const updatedColumns = board.columns.map((column: Column) =>
        column.slug === taskToDelete.status
          ? {
              ...column,
              tasks: column.tasks.filter((id: string) => id !== payload),
            }
          : column,
      );
      return {
        ...board,
        tasks: board.tasks.filter((task: Task) => task.id !== payload),
        columns: updatedColumns,
      };
    });

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.UPDATE_TASK]: (
    state: State,
    payload: Parameters<BoardContextValue["updateTask"]>,
  ): State => {
    const [taskId, updatedTask] = payload;

    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const updatedTasks = board.tasks.map((task: Task) =>
        task.id === taskId
          ? {
              ...task,
              title: updatedTask.title || task.title,
              slug: updatedTask.title
                ? stringToSlug(updatedTask.title)
                : task.slug,
              description:
                updatedTask.description !== undefined
                  ? updatedTask.description
                  : task.description,
              color: updatedTask.color || task.color,
              labels: updatedTask.labels || task.labels,
              members: updatedTask.members || task.members,
              dueDate:
                updatedTask.dueDate !== undefined
                  ? updatedTask.dueDate
                  : task.dueDate,
            }
          : task,
      );
      return { ...board, tasks: updatedTasks };
    });

    return {
      ...state,
      boards: updatedBoards,
    };
  },

  [ACTIONS.REORDER_TASK]: (
    state: State,
    payload: {
      cardId: string;
      columnId: string;
      startIndex: number;
      finishIndex: number;
      trigger: "keyboard" | "pointer";
    },
  ): State => {
    const { cardId, columnId, startIndex, finishIndex, trigger } = payload;

    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const updatedCols = board.columns.map((col: Column) => {
        if (col.id !== columnId) return col;

        const reordered = reorder({
          list: col.tasks,
          startIndex,
          finishIndex,
        });

        return {
          ...col,
          tasks: reordered,
        };
      });
      return { ...board, columns: updatedCols };
    });

    return {
      ...state,
      boards: updatedBoards,
      lastMoved: {
        trigger: trigger,
        outcome: {
          type: "card-reorder",
          cardId,
          columnId,
          startIndex,
          finishIndex,
        },
      },
    };
  },

  [ACTIONS.MOVE_TASK]: (
    state: State,
    payload: {
      cardId: string;
      startColumnId: string;
      finishColumnId: string;
      itemIndexInStartColumn: number;
      itemIndexInFinishColumn?: number;
      trigger: "keyboard" | "pointer";
    },
  ): State => {
    const {
      cardId,
      startColumnId,
      finishColumnId,
      itemIndexInStartColumn,
      itemIndexInFinishColumn,
      trigger,
    } = payload;

    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const sourceColumn = board.columns.find(
        (col: Column) => col.id === startColumnId,
      );

      if (!sourceColumn) return board;

      const destinationColumn = board.columns.find(
        (col: Column) => col.id === finishColumnId,
      );

      if (!destinationColumn) return board;

      const newIndexInDestination = itemIndexInFinishColumn ?? 0;

      // Create a copy to avoid direct mutations
      const sourceColumnCopy = {
        ...sourceColumn,
        tasks: [...sourceColumn.tasks],
      };
      const destinationColumnCopy = {
        ...destinationColumn,
        tasks: [...destinationColumn.tasks],
      };

      if (!destinationColumnCopy.tasks.includes(cardId)) {
        destinationColumnCopy.tasks.splice(newIndexInDestination, 0, cardId);
        const cardIndex = sourceColumnCopy.tasks.indexOf(cardId);
        if (cardIndex !== -1) {
          sourceColumnCopy.tasks.splice(cardIndex, 1);
        }
      }

      return {
        ...board,
        columns: board.columns.map((col: Column) => {
          if (col.id === startColumnId) return sourceColumnCopy;
          if (col.id === finishColumnId) return destinationColumnCopy;
          return col;
        }),
      };
    });

    return {
      ...state,
      boards: updatedBoards,
      lastMoved: {
        trigger: trigger,
        outcome: {
          type: "card-move",
          cardId,
          startColumnId,
          finishColumnId,
          itemIndexInStartColumn,
          itemIndexInFinishColumn,
        },
      },
    };
  },

  [ACTIONS.REORDER_COLUMN]: (
    state: State,
    payload: {
      columnId: string;
      startIndex: number;
      finishIndex: number;
      trigger: "keyboard" | "pointer";
    },
  ): State => {
    const { columnId, startIndex, finishIndex, trigger } = payload;

    const updatedBoards = state.boards.map((board: Board) => {
      if (board.id !== state.activeBoardId) return board;

      const reordered = reorder({
        list: board.columns,
        startIndex,
        finishIndex,
      });

      return {
        ...board,
        columns: reordered,
      };
    });

    return {
      ...state,
      boards: updatedBoards,
      lastMoved: {
        trigger: trigger,
        outcome: {
          type: "column-reorder",
          columnId,
          startIndex,
          finishIndex,
        },
      },
    };
  },
};

interface Action {
  type: ActionType;
  payload: any;
}

const boardReducer = (state: State, action: Action): State => {
  const handler = reducerHandlers[action.type];
  return handler ? handler(state, action.payload) : state;
};

export function BoardProvider({ children }: { children: ReactNode }) {
  const [{ boards, activeBoardId, lastMoved }, dispatch] = useReducer(
    boardReducer,
    undefined,
    createInitialState,
  );

  // Persiste os quadros no localStorage a cada mudança, para o estado
  // sobreviver a reloads e ser compartilhado com outras telas (ex.: To Do).
  useEffect(() => {
    saveBoards(boards);
  }, [boards]);

  const [registry] = useState(createRegistry);

  const [instanceId] = useState(() => Symbol("instance-id"));

  const currentBoard = boards.find(
    (board: Board) => board.id === activeBoardId,
  );

  const reorderColumn = useCallback(
    ({
      startIndex,
      columnId,
      finishIndex,
      trigger = "keyboard",
    }: {
      startIndex: number;
      columnId: string;
      finishIndex: number;
      trigger?: "keyboard" | "pointer";
    }) => {
      dispatch({
        type: ACTIONS.REORDER_COLUMN,
        payload: {
          columnId,
          startIndex,
          finishIndex,
          trigger,
        },
      });
    },
    [dispatch],
  );

  const reorderTask = useCallback(
    ({
      cardId,
      columnId,
      startIndex,
      finishIndex,
      trigger = "keyboard",
    }: {
      cardId: string;
      columnId: string;
      startIndex: number;
      finishIndex: number;
      trigger?: "keyboard" | "pointer";
    }) => {
      dispatch({
        type: ACTIONS.REORDER_TASK,
        payload: {
          cardId,
          columnId,
          startIndex,
          finishIndex,
          trigger,
        },
      });
    },
    [dispatch],
  );

  const moveCard = useCallback(
    ({
      cardId,
      startColumnId,
      finishColumnId,
      itemIndexInStartColumn,
      itemIndexInFinishColumn,
      trigger = "keyboard",
    }: {
      cardId: string;
      startColumnId: string;
      finishColumnId: string;
      itemIndexInStartColumn: number;
      itemIndexInFinishColumn?: number;
      trigger?: "keyboard" | "pointer";
    }) => {
      // invalid cross column movement
      if (startColumnId === finishColumnId) {
        return;
      }

      dispatch({
        type: ACTIONS.MOVE_TASK,
        payload: {
          startColumnId,
          finishColumnId,
          cardId,
          itemIndexInStartColumn,
          itemIndexInFinishColumn,
          trigger,
        },
      });
    },
    [dispatch],
  );

  useEffect(() => {
    if (lastMoved === null) {
      return;
    }
    const { outcome } = lastMoved;

    if (outcome.type === "column-reorder") {
      const { columnId } = outcome;
      if (!columnId) return;

      const entry = registry.getColumn(columnId);
      if (entry?.element) {
        triggerPostMoveFlash(entry.element);
      }
      return;
    }

    if (outcome.type === "card-move" || outcome.type === "card-reorder") {
      const { cardId } = outcome;
      if (!cardId) return;

      const entry = registry.getCard(cardId);
      if (entry?.element) {
        triggerPostMoveFlash(entry.element);
      }
      return;
    }
  }, [lastMoved, registry]);

  useEffect(() => {
    if (!currentBoard) return;

    return combine(
      monitorForElements({
        canMonitor({ source }: any) {
          return source.data.instanceId === instanceId;
        },
        onDrop(args: any) {
          const { location, source } = args;
          if (!location.current.dropTargets.length || !currentBoard) {
            return;
          }

          if (source.data.type === "column") {
            const columnId = source.data.columnId;

            const startIndex = currentBoard.columns.findIndex(
              ({ id }: { id: string }) => id === columnId,
            );

            const target = location.current.dropTargets[0];
            if (!target) return;

            const indexOfTarget = currentBoard.columns.findIndex(
              ({ id }: { id: string }) => id === target.data.columnId,
            );

            const closestEdgeOfTarget = extractClosestEdge(target.data);

            const finishIndex = getReorderDestinationIndex({
              startIndex,
              indexOfTarget,
              closestEdgeOfTarget,
              axis: "horizontal",
            });

            reorderColumn({
              startIndex,
              finishIndex,
              columnId,
              trigger: "pointer",
            });
          }

          if (source.data.type === "card") {
            const cardId = source.data.cardId;
            const sourceColumnId = source.data.columnId;

            invariant(typeof cardId === "string");
            invariant(typeof sourceColumnId === "string");

            const sourceColumn = currentBoard.columns.find(
              (c: Column) => c.id === sourceColumnId,
            );

            if (!sourceColumn) return;

            const cardIndex = sourceColumn.tasks.findIndex(
              (i: string) => i === cardId,
            );
            if (cardIndex === -1) return;

            if (location.current.dropTargets.length === 1) {
              const [destinationColumnRecord] = location.current.dropTargets;
              if (!destinationColumnRecord?.data?.columnId) return;

              const destinationId = destinationColumnRecord.data.columnId;

              invariant(typeof destinationId === "string");
              const destinationColumn = currentBoard.columns.find(
                ({ id }: { id: string }) => id === destinationId,
              );

              if (!destinationColumn) return;

              // reordering in same column
              if (sourceColumn.id === destinationColumn.id) {
                const tasksLength = Array.isArray(sourceColumn.tasks)
                  ? sourceColumn.tasks.length
                  : 0;

                const destinationIndex = getReorderDestinationIndex({
                  startIndex: cardIndex,
                  indexOfTarget: Math.max(0, tasksLength - 1),
                  closestEdgeOfTarget: null,
                  axis: "vertical",
                });

                reorderTask({
                  cardId,
                  columnId: sourceColumn.id,
                  startIndex: cardIndex,
                  finishIndex: destinationIndex,
                  trigger: "pointer",
                });
                return;
              }

              // moving to a new column
              moveCard({
                cardId,
                itemIndexInStartColumn: cardIndex,
                startColumnId: sourceColumn.id,
                finishColumnId: destinationColumn.id,
                itemIndexInFinishColumn: 0,
                trigger: "pointer",
              });
              return;
            }

            // dropping in a column (relative to a card)
            if (location.current.dropTargets.length === 2) {
              const [destinationCardRecord, destinationColumnRecord] =
                location.current.dropTargets;

              if (
                !destinationColumnRecord?.data?.columnId ||
                !destinationCardRecord?.data?.cardId
              )
                return;

              const destinationColumnId = destinationColumnRecord.data.columnId;
              invariant(typeof destinationColumnId === "string");

              const destinationColumn = currentBoard.columns.find(
                (c: Column) => c.id === destinationColumnId,
              );

              if (!destinationColumn) return;

              const indexOfTarget = destinationColumn.tasks.findIndex(
                (i: string) => i === destinationCardRecord.data.cardId,
              );

              if (indexOfTarget === -1) return;

              const closestEdgeOfTarget = extractClosestEdge(
                destinationCardRecord.data,
              );

              // case 1: ordering in the same column
              if (sourceColumn.id === destinationColumn.id) {
                const destinationIndex = getReorderDestinationIndex({
                  startIndex: cardIndex,
                  indexOfTarget,
                  closestEdgeOfTarget,
                  axis: "vertical",
                });

                if (cardIndex !== destinationIndex) {
                  reorderTask({
                    cardId: cardId,
                    columnId: sourceColumn.id,
                    startIndex: cardIndex,
                    finishIndex: destinationIndex,
                    trigger: "pointer",
                  });
                }

                return;
              }

              // case 2: moving into a new column relative to a card
              const destinationIndex =
                closestEdgeOfTarget === "bottom"
                  ? indexOfTarget + 1
                  : indexOfTarget;

              moveCard({
                cardId: cardId,
                itemIndexInStartColumn: cardIndex,
                startColumnId: sourceColumn.id,
                finishColumnId: destinationColumn.id,
                itemIndexInFinishColumn: destinationIndex,
                trigger: "pointer",
              });
            }
          }
        },
      }),
    );
  }, [currentBoard, instanceId, moveCard, reorderColumn, reorderTask]);

  // Memoize dispatch functions to prevent unnecessary re-renders of consumers
  const dispatchFunctions = useMemo<
    Omit<
      BoardContextValue,
      | "boards"
      | "currentBoard"
      | "instanceId"
      | "registerCard"
      | "registerColumn"
    >
  >(
    () => ({
      setActiveBoardId: (boardId) =>
        dispatch({ type: ACTIONS.SET_ACTIVE_BOARD, payload: boardId }),

      createBoard: (board) =>
        dispatch({ type: ACTIONS.CREATE_BOARD, payload: board }),

      updateBoard: (updatedBoard) =>
        dispatch({
          type: ACTIONS.UPDATE_BOARD,
          payload: updatedBoard,
        }),

      deleteBoard: (boardId) =>
        dispatch({ type: ACTIONS.DELETE_BOARD, payload: boardId }),

      createColumn: (column) =>
        dispatch({ type: ACTIONS.CREATE_COLUMN, payload: column }),

      updateColumn: (updatedColumn) =>
        dispatch({ type: ACTIONS.UPDATE_COLUMN, payload: updatedColumn }),

      deleteColumn: (columnId) =>
        dispatch({ type: ACTIONS.DELETE_COLUMN, payload: columnId }),

      createTask: (columnId, task) =>
        dispatch({ type: ACTIONS.CREATE_TASK, payload: [columnId, task] }),

      updateTask: (taskId, updatedTask) => {
        dispatch({
          type: ACTIONS.UPDATE_TASK,
          payload: [taskId, updatedTask],
        });
      },

      deleteTask: (taskId) =>
        dispatch({ type: ACTIONS.DELETE_TASK, payload: taskId }),
    }),
    [dispatch],
  );

  const value: BoardContextValue = {
    boards,
    currentBoard,
    instanceId,
    registerCard: registry.registerCard,
    registerColumn: registry.registerColumn,
    ...dispatchFunctions,
  };

  return <BoardContextProvider value={value}>{children}</BoardContextProvider>;
}
