// Import Dependencies
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
  Transition,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import {
  Fragment,
  useRef,
  ReactNode,
  Dispatch,
  SetStateAction,
  ReactElement,
} from "react";

// Local Imports
import { Input, InputErrorMsg } from "@/components/ui";
import { useFuse, useBoxPosition, useBoxSize, mergeRefs } from "@/hooks";
import { Highlight } from "../Highlight";

// ----------------------------------------------------------------------

interface DataItem {
  [key: string]: any;
}

interface ClassNames {
  root?: string;
  input?: string;
}

type BaseComboboxProps<TValue> = {
  data: DataItem[];
  placeholder?: string;
  label?: ReactNode;
  displayField?: string;
  error?: boolean | string;
  inputProps?: Record<string, any>;
  rootProps?: Record<string, any>;
  className?: string;
  classNames?: ClassNames;
  searchFields?: string[];
  highlight?: boolean;
  disabled?: boolean;
  name?: string;
  form?: string;
  invalid?: boolean;
  by?: ((a: TValue | null, z: TValue | null) => boolean) | keyof TValue;
};

type SingleComboboxProps<TValue> = BaseComboboxProps<TValue> & {
  multiple?: false;
  value?: TValue | null;
  onChange?: ((value: TValue) => void) | ((value: TValue | null) => void);
  defaultValue?: TValue | null;
};

type MultipleComboboxProps<TValue> = BaseComboboxProps<TValue> & {
  multiple: true;
  value?: TValue[];
  onChange?: ((value: TValue[]) => void) | Dispatch<SetStateAction<TValue[]>>;
  defaultValue?: TValue[];
};

export type StyledComboboxProps<TValue = DataItem> =
  | SingleComboboxProps<TValue>
  | MultipleComboboxProps<TValue>;

// Function overloads for proper type inference
function CustomCombobox<TValue = DataItem>(
  props: SingleComboboxProps<TValue>,
): ReactElement;
function CustomCombobox<TValue = DataItem>(
  props: MultipleComboboxProps<TValue>,
): ReactElement;

function CustomCombobox<TValue = DataItem>(
  props: StyledComboboxProps<TValue>,
): ReactElement {
  const {
    data,
    multiple,
    placeholder,
    label,
    error,
    displayField = "label",
    searchFields = [],
    highlight,
    inputProps,
    rootProps,
    classNames,
    value,
    onChange,
    defaultValue,
    disabled,
    name,
    form,
    by,
    ...headlessProps
  } = props;

  const {
    result: filteredData,
    query,
    setQuery,
  } = useFuse(data, {
    keys: searchFields,
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  const boxSizeRef = useRef<HTMLDivElement>(null);
  const { width: inputWidth } = useBoxSize({ ref: boxSizeRef });
  const { left: inputLeft, ref: boxPositionRef } = useBoxPosition();

  const getDisplayValue = (item: TValue | null | undefined): string => {
    if (!item) return "";
    return String((item as any)?.[displayField] ?? "");
  };

  const defaultBy = (a: TValue | null, z: TValue | null): boolean => {
    if (a === null || z === null || a === undefined || z === undefined)
      return a === z;
    return JSON.stringify(a) === JSON.stringify(z);
  };

  const handleChange = (newValue: any) => {
    onChange?.(newValue as any);
  };

  return (
    <div className={clsx("flex flex-col", classNames?.root)} {...rootProps}>
      <Combobox
        multiple={multiple}
        value={value}
        onChange={handleChange}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        form={form}
        by={by ?? defaultBy}
        {...(headlessProps as any)}
      >
        {({ open, value: selectedValue }) => {
          return (
            <>
              {label && <Label>{label}</Label>}
              <div
                ref={mergeRefs(boxPositionRef, boxSizeRef)}
                className={clsx("relative", label && "mt-1.5")}
              >
                {multiple ? (
                  <div>
                    <ComboboxButton
                      as="div"
                      className={clsx(
                        "relative w-full cursor-default overflow-hidden rounded-lg border text-start outline-hidden transition-colors focus:outline-hidden",
                        error
                          ? "border-error dark:border-error-lighter"
                          : "focus-within:border-primary-600! dark:focus-within:border-primary-500! dark:border-dark-450 dark:hover:border-dark-400 border-gray-300 hover:border-gray-400",
                      )}
                    >
                      <div className="flex flex-wrap justify-start gap-2 px-3 py-2 ltr:pr-9 rtl:pl-9">
                        {Array.isArray(selectedValue) &&
                          selectedValue.length > 0 && (
                            <div>
                              {selectedValue
                                .map((val) => getDisplayValue(val as TValue))
                                .join(", ")}
                            </div>
                          )}
                        <ComboboxInput
                          as={Input}
                          classNames={{
                            root: "flex-1",
                            input:
                              "dark:placeholder:text-dark-200 placeholder:font-light placeholder:text-gray-600",
                          }}
                          unstyled
                          displayValue={() => ""}
                          autoComplete="new"
                          placeholder={
                            (!Array.isArray(selectedValue) ||
                              selectedValue.length === 0) &&
                            query === ""
                              ? placeholder
                              : undefined
                          }
                          onChange={(
                            event: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            setQuery(event.target.value);
                          }}
                          value={query}
                          {...inputProps}
                        />
                      </div>

                      <div className="absolute inset-y-0 flex items-center ltr:right-0 ltr:pr-2 rtl:left-0 rtl:pl-2">
                        <ChevronDownIcon
                          className={clsx(
                            "dark:text-dark-300 size-5 text-gray-400 transition-transform",
                            open && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    </ComboboxButton>
                    <InputErrorMsg
                      when={Boolean(error && typeof error !== "boolean")}
                    >
                      {error}
                    </InputErrorMsg>
                  </div>
                ) : (
                  <ComboboxButton className="relative w-full cursor-pointer overflow-hidden text-start">
                    <ComboboxInput
                      as={Input}
                      autoComplete="new"
                      error={error}
                      displayValue={(val: TValue) => getDisplayValue(val)}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        setQuery(event.target.value)
                      }
                      placeholder={placeholder}
                      suffix={
                        <ChevronDownIcon
                          className={clsx(
                            "size-5 transition-transform",
                            open && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      }
                      {...inputProps}
                    />
                  </ComboboxButton>
                )}

                <Transition
                  as={Fragment}
                  enter="transition ease-out"
                  enterFrom="opacity-0 translate-y-2"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-2"
                  afterLeave={() => setQuery("")}
                >
                  <ComboboxOptions
                    anchor={{ to: "bottom end", gap: 8 }}
                    style={{
                      width: inputWidth,
                      ["--left-anchor" as string]: `${inputLeft}px`,
                    }}
                    className={clsx(
                      "dark:border-dark-500 dark:bg-dark-750 absolute left-(--left-anchor)! z-10 max-h-60 overflow-x-hidden overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden dark:shadow-none",
                      multiple && "mt-2",
                    )}
                  >
                    {filteredData.length === 0 && query !== "" ? (
                      <div className="dark:text-dark-100 relative cursor-default px-4 py-2 text-gray-800 select-none">
                        Nothing found for {query}
                      </div>
                    ) : (
                      filteredData.map(({ item, refIndex }) => (
                        <ComboboxOption
                          key={refIndex}
                          className={({
                            selected,
                            active,
                          }: {
                            selected: boolean;
                            active: boolean;
                          }) =>
                            clsx(
                              "relative cursor-pointer px-4 py-2 outline-hidden transition-colors select-none",
                              active &&
                                !selected &&
                                "dark:bg-dark-600 bg-gray-100",
                              selected
                                ? "bg-primary-600 dark:bg-primary-500 text-white"
                                : "dark:text-dark-100 text-gray-800",
                            )
                          }
                          value={item}
                        >
                          {({ selected }: { selected: boolean }) => (
                            <span
                              className={`block truncate ${
                                selected ? "font-medium" : "font-normal"
                              }`}
                            >
                              {highlight ? (
                                <Highlight query={query}>
                                  {String(
                                    item?.[displayField as keyof DataItem] ??
                                      "",
                                  )}
                                </Highlight>
                              ) : (
                                String(
                                  item?.[displayField as keyof DataItem] ?? "",
                                )
                              )}
                            </span>
                          )}
                        </ComboboxOption>
                      ))
                    )}
                  </ComboboxOptions>
                </Transition>
              </div>
            </>
          );
        }}
      </Combobox>
    </div>
  );
}

CustomCombobox.displayName = "Combobox";

export { CustomCombobox as Combobox };
