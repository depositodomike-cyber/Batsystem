// Import Dependencies
import clsx from "clsx";
import {
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { useBoardContext } from "../../Board.context";
import { AddBoard } from "../../Modals/AddBoard";

// ----------------------------------------------------------------------

export function Boards() {
  const [isOpenModal, { open, close }] = useDisclosure(false);
  const { boards, currentBoard, setActiveBoardId } = useBoardContext();

  return (
    <>
      <div className="pt-4">
        <div className="flex min-w-0 items-center justify-between px-4">
          <span className="text-tiny-plus truncate font-medium uppercase">
            Boards
          </span>

          <div className="flex ltr:-mr-1.5 rtl:-ml-1.5">
            <Button
              onClick={open}
              variant="flat"
              isIcon
              className="size-6 rounded-full"
              aria-label="New Board"
            >
              <PlusIcon className="size-3.5 stroke-2" />
            </Button>
            <Button variant="flat" isIcon className="size-6 rounded-full">
              <MagnifyingGlassIcon className="size-3.5 stroke-2" />
            </Button>
          </div>
        </div>
        <ul className="space-y-1.5 px-2 pt-1 font-medium">
          {boards && boards.length > 0 ? (
            boards.map((board) => (
              <li key={board.id}>
                <Button
                  color={board.id === currentBoard?.id ? "primary" : "neutral"}
                  variant={board.id === currentBoard?.id ? "soft" : "flat"}
                  className="group text-xs-plus w-full justify-between gap-2 p-2"
                  onClick={() => setActiveBoardId(board.id)}
                >
                  <span
                    className={clsx(
                      "truncate",
                      board.id !== currentBoard?.id &&
                        "dark:text-dark-100 text-gray-800",
                    )}
                  >
                    {board.name}
                  </span>
                  {board.isPrivate && (
                    <LockClosedIcon className="text-error dark:text-error-light size-4.5" />
                  )}
                </Button>
              </li>
            ))
          ) : (
            <span className="dark:text-dark-300 px-2 text-xs text-gray-400 italic">
              Not any board
            </span>
          )}
        </ul>
      </div>
      <AddBoard isOpen={isOpenModal} close={close} />
    </>
  );
}
