export type DraggableState = {
  type: string;
  container?: HTMLElement;
};

export type ItemPosition = "first" | "last" | "middle" | "only";

export type CleanupFn = () => void;

export type ItemEntry = { itemId: string; element: HTMLElement };
