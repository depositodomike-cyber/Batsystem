// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Radio,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { RadioGroup } from "@headlessui/react";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import clsx from "clsx";
import { Fragment, useEffect } from "react";

// Local Imports
import { Button, Input } from "@/components/ui";
import { useBoardContext } from "../Board.context";
import { colors } from "../data";

// ----------------------------------------------------------------------

const schema = Yup.object({
  name: Yup.string().required("Please enter the name of column"),
  color: Yup.string().required("Please select a color").oneOf(colors),
});

type FormStateType = Yup.InferType<typeof schema>;

export function EditColumn({
  isOpen,
  close,
  columnId,
}: {
  isOpen: boolean;
  close: () => void;
  columnId: string;
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
            Edit Column
          </DialogTitle>
          <EditColumnForm close={close} columnId={columnId} />
        </div>
      </TransitionChild>
    </Transition>
  );
}

function EditColumnForm({
  close,
  columnId,
}: {
  close: () => void;
  columnId: string;
}) {
  const { updateColumn, currentBoard } = useBoardContext();

  const columnData = currentBoard?.columns.find(
    (column) => column.id === columnId,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus,
  } = useForm<FormStateType>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: columnData?.name,
      color: columnData?.color,
    },
  });

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const onSubmit = (data: any) => {
    updateColumn({ id: columnId, ...data });
    close();
  };

  return (
    <form className="pt-4" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
      <Input
        {...register("name")}
        label="Column Name:"
        error={errors?.name?.message}
        placeholder="Enter Column Name"
      />
      <div className="pt-4">
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
          name="color"
          control={control}
        />
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button onClick={close} variant="flat" className="min-w-[8rem]">
          Cancel
        </Button>
        <Button type="submit" color="primary" className="min-w-[8rem]">
          Update Column
        </Button>
      </div>
    </form>
  );
}
