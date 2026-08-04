// Import Dependencies
import invariant from 'tiny-invariant';

// ----------------------------------------------------------------------

// Define interfaces for better type checking, assuming entry is of type 'any' for now.
// You might want to replace 'any' with a more specific type based on what 'entry' represents.
export interface CardEntry {
    // Define properties of a card entry here if known, otherwise keep as 'any'
    [key: string]: any;
}

export interface ColumnEntry {
    // Define properties of a column entry here if known, otherwise keep as 'any'
    [key: string]: any;
}

export function createRegistry() {
    const cards = new Map<string, CardEntry>();
    const columns = new Map<string, ColumnEntry>();

    function registerCard({ cardId, entry }: { cardId: string; entry: CardEntry }) {
        cards.set(cardId, entry);

        return function cleanup() {
            cards.delete(cardId);
        };
    }

    function registerColumn({
        columnId,
        entry,
    }: { columnId: string; entry: ColumnEntry }) {
        columns.set(columnId, entry);
        return function cleanup() {
            columns.delete(columnId); 
        };
    }

    function getCard(cardId: string): CardEntry {
        const entry = cards.get(cardId);
        invariant(entry, `Card with id "${cardId}" not found.`);
        return entry;
    }

    function getColumn(columnId: string): ColumnEntry {
        const entry = columns.get(columnId);
        invariant(entry, `Column with id "${columnId}" not found.`);
        return entry;
    }

    return { registerCard, registerColumn, getCard, getColumn };
}
