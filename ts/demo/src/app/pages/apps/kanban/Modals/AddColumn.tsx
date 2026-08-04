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
  name: Yup.string().required("Informe o nome da etapa"),
  color: Yup.string().required("Selecione uma cor").oneOf(colors),
});

type FormStateType = Yup.InferType<typeof schema>;

export function AddColumn({
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
            Nova etapa
          </DialogTitle>
          <AddColumnForm close={close} />
        </div>
      </TransitionChild>
    </Transition>
  );
}

function AddColumnForm({ close }: { close: () => void }) {
  const { createColumn } = useBoardContext();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus,
  } = useForm<FormStateType>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: "",
      color: "primary",
    },
  });

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const onSubmit = (data: any) => {
    createColumn(data);
    close();
  };

  return (
    <form className="pt-4" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
      <Input
        {...register("name")}
        label="Nome da etapa:"
        error={errors?.name?.message}
        placeholder="Digite o nome da etapa"
      />
      <div className="pt-4">
        <div>Cor:</div>

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
          Cancelar
        </Button>
        <Button type="submit" color="primary" className="min-w-[8rem]">
          Criar etapa
        </Button>
      </div>
    </form>
  );
}
