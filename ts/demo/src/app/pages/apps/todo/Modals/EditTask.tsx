// Import Dependencies
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment, useEffect } from "react";
import { StarIcon as StarIconFilled } from "@heroicons/react/20/solid";
import {
  StarIcon as StarIconOutline,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import * as Yup from "yup";
import { Controller, Resolver, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

// Local Imports
import { useTodoContext } from "../Todo.context";
import {
  Button,
  Checkbox,
  Input,
  Swap,
  SwapOff,
  SwapOn,
  Textarea,
} from "@/components/ui";
import { DatePicker } from "@/components/shared/form/Datepicker";
import { LabelsField } from "./components/LablesField";
import { AssignsField } from "./components/AssignsField";
import type { Todo } from "../data";

// ----------------------------------------------------------------------

type TodoFormData = Partial<Todo> & { title: string };

const schema = Yup.object().shape({
  title: Yup.string().required("Please enter the title of task"),
  labels: Yup.array().of(Yup.object()), 
  assignedTo: Yup.array().of(Yup.object()),
  description: Yup.string(),
  dueDate: Yup.date().nullable(),
});

export function EditTask({
  data,
  isOpen,
  close,
}: {
  data: Todo;
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-100" onClose={close}>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity dark:bg-black/40"
        />

        <TransitionChild
          as={DialogPanel}
          enter="ease-out transform-gpu transition-transform duration-200"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in transform-gpu transition-transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
          className="dark:bg-dark-700 fixed top-0 right-0 flex h-full w-full max-w-3xl transform-gpu flex-col bg-white transition-transform duration-200"
        >
          <EditTaskForm data={data} close={close} />
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

function EditTaskForm({ data, close }: { data: Todo; close: () => void }) {
  const { setIsDone, setIsImportant, updateTodo, deleteTodo } =
    useTodoContext();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus,
  } = useForm<TodoFormData>({
    resolver: yupResolver(schema) as Resolver<TodoFormData>,
    defaultValues: {
      title: data.title || "", 
      labels: data.labels || [],
      assignedTo: data.assignedTo || [],
      dueDate: data.dueDate || null,
      description: data.description || "",
    },
    
  });

  useEffect(() => {
    setFocus("title");
  }, [setFocus]);

  const onSubmit = (formData: TodoFormData) => {
    const payload = {
      ...formData,
      description: formData.description || undefined,
      labels: formData.labels || [],
      assignedTo: formData.assignedTo || [],
    };
    updateTodo(data.id, payload);
    close();
  };

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
    >
      <header className="dark:bg-dark-800 flex h-14 items-center justify-between bg-gray-100 px-4">
        <h3 className="dark:text-dark-100 text-base font-medium text-gray-800">
          Edit Todo
        </h3>
        <div className="flex items-center">
          <div className="flex size-7 items-center justify-center">
            <Checkbox
              checked={data.isDone}
              onChange={(e) => setIsDone(data.id, e.target.checked)}
              className="rounded-full"
            />
          </div>

          <Swap
            value={data.isImportant ? "on" : "off"}
            onChange={(val) => setIsImportant(data.id, val === "on")}
            className="inline-block align-middle"
          >
            <Button isIcon variant="flat" className="size-7 rounded-full">
              <SwapOn>
                <StarIconFilled className="text-primary-600 dark:text-primary-400 size-4.5" />
              </SwapOn>
              <SwapOff>
                <StarIconOutline className="size-4.5" />
              </SwapOff>
            </Button>
          </Swap>

          <Button
            onClick={close}
            isIcon
            variant="flat"
            className="size-7 rounded-full"
          >
            <XMarkIcon className="size-4.5" />
          </Button>
        </div>
      </header>
      <div className="grid grow grid-cols-1 place-content-start gap-4 overflow-y-auto p-4 sm:grid-cols-2">
        <Input
          {...register("title")}
          error={errors?.title?.message}
          placeholder="Enter Task Titile"
          label="Title"
        />

        <Controller
          render={({ field }) => (
            <DatePicker
              label="Due date:"
              placeholder="Choose due date..."
              options={{
                enableTime: true,
                time_24hr: true,
              }}
              value={field.value || ""}
              onChange={field.onChange}
              name={field.name}
              onBlur={field.onBlur}
              disabled={field.disabled}
            />
          )}
          control={control}
          name="dueDate"
        />

        <Controller
          render={({ field: { onChange, value, name } }) => (
            <LabelsField onChange={onChange} value={value || []} name={name} />
          )}
          control={control}
          name="labels"
        />

        <Controller
          render={({ field: { onChange, value, name } }) => (
            <AssignsField onChange={onChange} value={value || []} name={name} />
          )}
          control={control}
          name="assignedTo"
        />

        <Textarea
          classNames={{
            root: "sm:col-span-2",
          }}
          {...register("description")}
          label="Description"
          placeholder="Enter Task Description"
          rows={4}
        />
      </div>
      <div className="dark:border-dark-500 flex justify-between border-t border-gray-200 p-4">
        <Button
          onClick={() => deleteTodo(data.id)}
          color="error"
          className="gap-2 md:min-w-[8rem]"
        >
          <TrashIcon className="size-4.5" />
          <div className="max-md:hidden">Delete</div>
        </Button>

        <div className="flex justify-end gap-4">
          <Button onClick={close} variant="flat" className="min-w-[8rem]">
            Cancel
          </Button>
          <Button type="submit" color="primary" className="min-w-[8rem]">
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
