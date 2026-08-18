// Import Dependencies
import { FaListCheck } from "react-icons/fa6";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import invariant from "tiny-invariant";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { centerUnderPointer } from "@atlaskit/pragmatic-drag-and-drop/element/center-under-pointer";
import {
  attachClosestEdge,
  Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";

// Local Imports
import { Avatar, Box, ScrollShadow } from "@/components/ui";
import { DropIndicator } from "@/components/shared/DropIndicator";
import { getUserAgentBrowser } from "@/utils/dom/getUserAgentBrowser";
import { ActionMenu } from "./ActionMenu";
import { AddTask } from "./Task/AddTask";
import { useBoardContext } from "../../Board.context";
import { TaskCard } from "./Task/TaskCard";
import type { Column as ColumnType, Task as TaskType } from "../../data";

// ----------------------------------------------------------------------

const isSafari = getUserAgentBrowser() === "Safari";

// State Types
type IdleState = { type: "idle" };
type DraggingState = { type: "dragging" };
type SafariPreviewState = {
  type: "preview-safari-column";
  container: HTMLElement;
};
type ColumnOverState = { type: "is-column-over"; closestEdge: Edge | null };

type ColDraggableState =
  | IdleState
  | DraggingState
  | SafariPreviewState
  | ColumnOverState;
type CardDraggableState = IdleState | DraggingState;

const idle: IdleState = { type: "idle" };
const dragging: DraggingState = { type: "dragging" };

// Props Type
interface ColumnProps {
  data: ColumnType;
  tasks: TaskType[];
}

export function Column({ data, tasks }: ColumnProps) {
  const { id, color, Icon, name } = data;
  const [colDraggableState, setColDraggableState] =
    useState<ColDraggableState>(idle);
  const [cardDraggableState, setCardDraggableState] =
    useState<CardDraggableState>(idle);
  const tasksWrapperRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const addTaskBtnRef = useRef<HTMLButtonElement>(null);

  const { instanceId, registerColumn } = useBoardContext();

  const scrollToBottom = () => {
    tasksWrapperRef?.current?.scrollTo({
      top: tasksWrapperRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const column = columnRef.current;
    const header = headerRef.current;
    const tasksWrapper = tasksWrapperRef.current;
    invariant(column, "Column ref not set");
    invariant(header, "Header ref not set");
    invariant(tasksWrapper, "Tasks wrapper ref not set");

    return combine(
      registerColumn({
        columnId: id,
        entry: {
          element: column,
        },
      }),
      draggable({
        element: column,
        dragHandle: header,
        getInitialData: () => ({ columnId: id, type: "column", instanceId }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          if (!isSafari) return;

          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: centerUnderPointer,
            render: ({ container }) => {
              setColDraggableState({
                type: "preview-safari-column",
                container,
              });
              return () => setColDraggableState(dragging);
            },
          });
        },
        onDragStart: () => {
          setColDraggableState(dragging);
        },
        onDrop() {
          setColDraggableState(idle);
        },
      }),
      dropTargetForElements({
        element: tasksWrapper,
        getData: () => ({ columnId: id }),
        canDrop: ({ source }) => {
          return (
            source.data.instanceId === instanceId && source.data.type === "card"
          );
        },
        getIsSticky: () => true,
        onDragEnter: () => setCardDraggableState(dragging),
        onDragLeave: () => setCardDraggableState(idle),
        onDragStart: () => setCardDraggableState(dragging),
        onDrop: () => setCardDraggableState(idle),
      }),
      dropTargetForElements({
        element: column,
        canDrop: ({ source }) => {
          return (
            source.data?.instanceId === instanceId &&
            source.data?.type === "column"
          );
        },
        getIsSticky: () => true,
        getData: ({ input, element }) => {
          const data = {
            columnId: id,
          };
          return attachClosestEdge(data, {
            input,
            element,
            allowedEdges: ["left", "right"],
          });
        },
        onDragEnter: (args) => {
          setColDraggableState({
            type: "is-column-over",
            closestEdge: extractClosestEdge(args.self.data),
          });
        },
        onDrag: (args) => {
          // skip react re-render if edge is not changing
          setColDraggableState((current) => {
            const closestEdge = extractClosestEdge(args.self.data);
            if (
              current.type === "is-column-over" &&
              current.closestEdge === closestEdge
            ) {
              return current;
            }
            return {
              type: "is-column-over",
              closestEdge,
            };
          });
        },
        onDragLeave: () => {
          setColDraggableState(idle);
        },
        onDrop: () => {
          setColDraggableState(idle);
        },
      }),
      autoScrollForElements({
        element: tasksWrapper,
        canScroll: ({ source }) =>
          source.data.instanceId === instanceId && source.data.type === "card",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, instanceId, registerColumn]);

  const tasksIdList: string[] = data.tasks || [];

  return (
    <div
      className={clsx(
        "relative -mx-0.5 flex h-full shrink-0 flex-col rounded-lg px-0.5 ring-inset",
        cardDraggableState.type === "dragging" &&
          "dark:bg-surface-3 bg-gray-100",
      )}
    >
      <div
        ref={columnRef}
        className={clsx(
          "relative flex max-h-full w-[85vw] max-w-72 shrink-0 flex-col rounded-lg sm:w-72",
          colDraggableState.type === "dragging" && "opacity-60",
        )}
      >
        <div
          ref={headerRef}
          className="flex min-w-0 items-center justify-between pb-1"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar
              size={8}
              initialColor={color}
              initialVariant={color === "neutral" ? "filled" : "soft"}
              classNames={{
                display: "rounded-lg",
              }}
            >
              {Icon ? (
                <Icon className="size-4" />
              ) : (
                <FaListCheck className="size-4" />
              )}
            </Avatar>
            <span className="dark:text-dark-100 truncate text-base text-gray-800">
              {name}
            </span>
          </div>
          <ActionMenu columnId={id} />
        </div>
        <ScrollShadow
          ref={tasksWrapperRef}
          className="hide-scrollbar relative space-y-2.5 overflow-y-auto pt-1.5"
        >
          {tasksIdList?.length > 0 ? (
            tasksIdList.map((taskId) => {
              const task = tasks.filter((task) => task.id === taskId)[0];
              return <TaskCard data={task} columnData={data} key={taskId} />;
            })
          ) : (
            <div>
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <div className="dark:text-dark-300 flex items-center gap-2 text-gray-600">
                  <span className="text-xl">👀</span>
                  <span className="text-lg">Sem atividades</span>
                </div>
                <button
                  onClick={() => addTaskBtnRef?.current?.click()}
                  className="dark:text-dark-300 text-center text-sm text-gray-400"
                >
                  Adicione atividades aqui para começar
                </button>
              </div>
            </div>
          )}
        </ScrollShadow>

        <AddTask
          columnId={id}
          scrollToBottom={scrollToBottom}
          addTaskBtnRef={addTaskBtnRef}
        />
      </div>
      {colDraggableState.type === "is-column-over" &&
        colDraggableState.closestEdge && (
          <DropIndicator edge={colDraggableState.closestEdge} gap="13px" />
        )}
      {colDraggableState.type === "preview-safari-column"
        ? createPortal(
            <Box className="dark:bg-dark-800 h-5 max-w-sm rounded-sm bg-gray-200 px-1 py-0.5 text-black dark:text-white">
              {name}
            </Box>,
            colDraggableState.container,
          )
        : null}
    </div>
  );
}
