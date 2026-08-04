// Local Imports
import { createSafeContext } from '@/utils/createSafeContext';
import type { ChatContextValue } from './ChatProvider';

export const [ChatContextProvider, useChatContext] = createSafeContext<ChatContextValue>(
    "useChatContext must be used within ChatProvider"
);
