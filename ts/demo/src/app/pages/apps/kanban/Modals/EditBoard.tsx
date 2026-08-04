// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Radio,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { RadioGroup } from "@headlessui/react";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, Resolver, useFieldArray, useForm } from "react-hook-form";
import clsx from "clsx";
import { Fragment, useEffect } from "react";

// Local Imports
import { Button, Input, Switch } from "@/components/ui";
import { useBoardContext } from "../Board.context";
import { colors } from "../data";

// ----------------------------------------------------------------------

const schema = Yup.object({
  name: Yup.string().required("Please enter the name of board"),
  columns: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required("Please enter the name of column"),
      color: Yup.string().required("Please select a color").oneOf(colors),
    }),
  ),
  isPrivate: Yup.bool(),
});

type FormStateType = Yup.InferType<typeof schema>;

export function EditBoard({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <Transition
      appear
      show={isOpen}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={close}
    >
      <TransitionChild
        as="div"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute inset-0 bg-gray-900/50 transition-opacity dark:bg-black/40"
      />

      <TransitionChild
        as={DialogPanel}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="hide-scrollbar dark:bg-dark-700 relative flex w-full max-w-md flex-col overflow-y-auto rounded-lg bg-white p-4 transition-opacity duration-300 sm:px-5"
      >
        <div className="w-full">
          <DialogTitle
            as="h3"
            className="dark:text-dark-100 text-lg text-gray-800"
          >
            Edit Board
          </DialogTitle>
          <EditBoardForm close={close} />
        </div>
      </TransitionChild>
    </Transition>
  );
}

function EditBoardForm({ close }: { close: () => void }) {
  const { currentBoard, updateBoard } = useBoardContext();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus,
  } = useForm<FormStateType>({
    resolver: yupResolver(schema) as Resolver<FormStateType>,
    defaultValues: {
      name: currentBoard?.name,
      columns: currentBoard?.columns.map(({ id, name, color }) => {
        return { id, name, color };
      }),
      isPrivate: currentBoard?.isPrivate,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "columns",
  });

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const onSubmit = (data: any) => {
    updateBoard(data);
    close();
  };

  return (
    <form className="pt-4" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
      <Input
        {...register("name")}
        label="Board Name:"
        error={errors?.name?.message}
        placeholder="Enter Board Name"
      />
      <ul className="mt-4 flex flex-col">
        {fields.map((item, index) => (
          <li key={item.id}>
            <Input
              label="Column name:"
              placeholder="Enter Column Name"
              {...register(`columns.${index}.name`)}
              error={errors?.columns?.[index]?.name?.message}
              id={`new-board-columns.${index}.name`}
            />
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div>Color:</div>

                <Controller
                  render={({ field }) => (
                    <RadioGroup className="mt-2 flex gap-1.5" {...field}>
                      {colors.map((color) => (
                        <Radio as={Fragment} key={color} value={color}>
                          {({ checked }) => (
                            <Button
                              isIcon
                              color={color}
                              className={clsx(
                                "dark:ring-offset-dark-700 size-4 rounded-full ring-inherit ring-offset-2 ring-offset-white",
                                checked && "ring-2",
                              )}
                            />
                          )}
                        </Radio>
                      ))}
                    </RadioGroup>
                  )}
                  name={`columns.${index}.color`}
                  control={control}
                />
              </div>

              <Button
                onClick={() => remove(index)}
                color="error"
                isIcon
                variant="flat"
                className="size-7"
              >
                <TrashIcon className="size-4.5" />
              </Button>
            </div>

            <div className="dark:bg-dark-500 my-4 h-px bg-gray-200"></div>
          </li>
        ))}
        <Button
          variant="outlined"
          onClick={() => append({ name: "", color: "neutral" })}
        >
          Add Column
        </Button>
      </ul>
      <div className="mt-4">
        <Switch label="Private Board" {...register("isPrivate")} />
      </div>
      <div className="mt-6 flex justify-end gap-4">
        <Button onClick={close} variant="flat" className="min-w-[8rem]">
          Cancel
        </Button>
        <Button type="submit" color="primary" className="min-w-[8rem]">
          Update Board
        </Button>
      </div>
    </form>
  );
}
