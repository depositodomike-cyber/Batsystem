// Import Dependencies
import { PlusIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import { AddColumn } from "../Modals/AddColumn";

// ----------------------------------------------------------------------

export function AddColumnButton() {
  const [isOpen, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button
        className="w-[85vw] max-w-72 shrink-0 gap-2 sm:w-72"
        onClick={open}
      >
        <PlusIcon className="size-4.5" />
        <span>Nova etapa</span>
      </Button>

      <AddColumn isOpen={isOpen} close={close} />
    </>
  );
}
