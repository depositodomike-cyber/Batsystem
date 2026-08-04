// Import Dependencies
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, Fragment } from "react";
import { flushSync } from "react-dom";
import * as Yup from "yup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

// Local Imports
import { Button, Textarea } from "@/components/ui";
import { useBoardContext } from "../../../Board.context";

// ----------------------------------------------------------------------

const schema = Yup.object().shape({
  title: Yup.string().required("Informe o título"),
});

type FormStateType = Yup.InferType<typeof schema>;

interface AddTaskProps {
  columnId: string;
  scrollToBottom: () => void;
  addTaskBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export function AddTask({
  columnId,
  scrollToBottom,
  addTaskBtnRef,
}: AddTaskProps) {
  return (
    <div className="py-1.5">
      <Popover className="relative w-full">
        <PopoverButton
          ref={addTaskBtnRef}
          as={Button}
          variant="flat"
          className="w-full gap-2"
        >
          <PlusIcon className="size-4.5" />
          <span>Nova atividade</span>
        </PopoverButton>
        <Transition
          as={Fragment}
          enter="transition ease-out"
          enterFrom="opacity-0 translate-y-2"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-2"
        >
          <PopoverPanel className="ring-primary-500/50 dark:border-dark-500 dark:bg-dark-750 absolute inset-x-0 bottom-0 z-100 w-full rounded-md border border-gray-300 bg-white p-2 shadow-lg shadow-gray-200/50 outline-hidden focus-within:ring-3 focus-visible:outline-hidden dark:shadow-none">
            {({ close }) => (
              <AddTaskForm
                columnId={columnId}
                scrollToBottom={scrollToBottom}
                close={close}
              />
            )}
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  );
}

function AddTaskForm({
  columnId,
  close,
  scrollToBottom,
}: {
  columnId: string;
  close: () => void;
  scrollToBottom: () => void;
}) {
  const { createTask } = useBoardContext();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<FormStateType>({
    resolver: yupResolver(schema),
    defaultValues: {
      title: "",
    },
  });

  const onSubmit = (data: any) => {
    flushSync(() => {
      createTask(columnId, data);
    });
    scrollToBottom();
    close();
  };

  useEffect(() => {
    setFocus("title");
  }, [setFocus]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
      <Textarea
        {...register("title")}
        unstyled
        placeholder="Título da nova atividade"
        className="resize-none"
        rows={2}
        error={errors?.title?.message}
      />

      <div className="flex justify-end gap-2">
        <Button onClick={close} className="px-3 py-1 text-xs">
          Cancelar
        </Button>
        <Button type="submit" color="primary" className="px-3 py-1 text-xs">
          Adicionar
        </Button>
      </div>
    </form>
  );
}
