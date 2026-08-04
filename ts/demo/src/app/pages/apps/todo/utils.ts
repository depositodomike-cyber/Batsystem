import { Todo } from "./data";

export const todoKey = Symbol("todo");

interface TodoDataParams {
  todo: Todo;
  index: number; 
  instanceId: () => symbol;
}

interface TodoData {
  [todoKey]: boolean;
  todo: Todo;
  index: number;
  instanceId: () => symbol;
}

interface RegisterParams {
  itemId: string;
  element: HTMLElement;
}

interface ItemRegistry {
  register: (params: RegisterParams) => () => void;
  getElement: (itemId: string) => HTMLElement | null;
}

export function getTodoData({ todo, index, instanceId }: TodoDataParams): TodoData {
    return {
        [todoKey]: true,
        todo,
        index,
        instanceId,
    };
}

export function getItemRegistry(): ItemRegistry {
    const registry = new Map<string, HTMLElement>();

    function register({ itemId, element }: RegisterParams): () => void {
        registry.set(itemId, element);

        return function unregister() {
            registry.delete(itemId);
        };
    }

    function getElement(itemId: string): HTMLElement | null {
        return registry.get(itemId) ?? null;
    }

    return { register, getElement };
}

export function isItemData(data: unknown, itemKey: symbol): boolean {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    return (data as Record<symbol, unknown>)[itemKey] === true;
}

interface GetItemPositionParams {
    index: number;
    items: any[];
}

type ItemPosition = 'only' | 'first' | 'last' | 'middle';

export function getItemPosition({ index, items }: GetItemPositionParams): ItemPosition {
    if (items.length === 1) {
        return 'only';
    }

    if (index === 0) {
        return 'first';
    }

    if (index === items.length - 1) {
        return 'last';
    }

    return 'middle';
}
