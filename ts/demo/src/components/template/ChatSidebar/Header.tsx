// Import Dependencies
import { ChatBubbleOvalLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------

export function Header({ close }: { close: () => void }) {
  return (
    <div className="dark:border-dark-600 flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div className="flex shrink-0 items-center gap-2">
        <ChatBubbleOvalLeftIcon className="size-5" />
        <span className="dark:text-dark-100 font-medium text-gray-800">
          Chat
        </span>
      </div>
      <Button
        onClick={close}
        variant="flat"
        isIcon
        className="size-6 rounded-full ltr:-mr-1 rtl:-ml-1"
      >
        <XMarkIcon className="size-4" />
      </Button>
    </div>
  );
}
