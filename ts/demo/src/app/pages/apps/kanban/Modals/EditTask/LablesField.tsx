// Import Dependencies
import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
  Transition,
} from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

// Local Imports
import { Label as LabelType, labels } from "../../data";
import { Input, Tag } from "@/components/ui";

// ----------------------------------------------------------------------

export function LabelsField({
  onChange,
  value,
  name,
}: {
  onChange: (value: LabelType[]) => void;
  value?: LabelType[];
  name: string;
}) {
  const [query, setQuery] = useState("");

  const filteredLabels =
    query === ""
      ? labels
      : labels.filter((label) =>
          label.text
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(query.toLowerCase().replace(/\s+/g, "")),
        );

  const removeItem = (id: string) => {
    const newValue = value?.filter((item: LabelType) => item.id !== id);
    onChange(newValue || []);
  };

  return (
    <Combobox
      value={value || []}
      onChange={onChange}
      name={name}
      by={(a, b) => a?.id === b?.id}
      multiple
      immediate
    >
      {({ open }) => (
        <div className="relative">
          <Label>Labels:</Label>

          <div
            className={clsx(
              "relative mt-1.5 rounded-lg border transition-colors",
              open
                ? "border-primary-600 dark:border-primary-500"
                : "dark:border-dark-450 dark:hover:border-dark-400 border-gray-300 hover:border-gray-400",
            )}
          >
            <ul
              className={clsx(
                "flex flex-wrap gap-1.5 border-b px-3 py-2 transition-colors",
                open
                  ? "border-primary-600 dark:border-primary-500"
                  : "dark:border-dark-450 border-gray-300",
              )}
            >
              {value && value.length > 0 ? (
                value.map((label) => (
                  <li key={label.id}>
                    <Tag
                      onClick={() => removeItem(label.id)}
                      component="button"
                      type="button"
                      color={label.color}
                      variant="soft"
                    >
                      {label.text}
                    </Tag>
                  </li>
                ))
              ) : (
                <span className="dark:text-dark-300 h-6 text-gray-400 italic">
                  Not Selected Labels
                </span>
              )}
            </ul>

            <div className="relative w-full cursor-default overflow-hidden px-3 py-2 text-start outline-hidden ltr:pr-9 rtl:pl-9">
              <ComboboxInput
                as={Input}
                unstyled
                classNames={{
                  root: "flex-1",
                  input:
                    "dark:placeholder:text-dark-300 placeholder:text-gray-400",
                }}
                displayValue={(label: LabelType) => label.text}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                value={query}
                placeholder="Select Labels"
              />
              <ComboboxButton className="absolute inset-y-0 flex items-center ltr:right-0 ltr:pr-2 rtl:left-0 rtl:pl-2">
                <ChevronDownIcon
                  className={clsx(
                    "dark:text-dark-300 size-5 text-gray-400 transition-transform",
                    open && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </ComboboxButton>
            </div>

            <Transition
              as={ComboboxOptions}
              enter="transition ease-out"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
              className="dark:border-dark-500 dark:bg-dark-700 absolute z-10 mt-1 max-h-60 w-full overflow-x-hidden overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden dark:shadow-none"
            >
              {filteredLabels.length === 0 && query !== "" ? (
                <div className="dark:text-dark-100 relative cursor-default px-4 py-2 text-gray-800 select-none">
                  Nothing found for {query}
                </div>
              ) : (
                filteredLabels.map((label) => (
                  <ComboboxOption
                    key={label.id}
                    className={({ selected, active }) =>
                      clsx(
                        "relative cursor-pointer px-4 py-2 outline-hidden transition-colors select-none",
                        (active || selected) &&
                          "dark:text-dark-100 text-gray-800",
                        active && !selected && "dark:bg-dark-600 bg-gray-100",
                        selected && "dark:bg-dark-500 bg-gray-200",
                      )
                    }
                    value={label}
                  >
                    {({ selected }) => (
                      <span className="flex items-center justify-between">
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={clsx(
                              "size-2 rounded-full",
                              label.color === "neutral"
                                ? "dark:bg-dark-400 bg-gray-200"
                                : `bg-this this:${label.color}`,
                            )}
                          />
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {label.text}
                          </span>
                        </span>
                        {selected && <CheckIcon className="size-4.5" />}
                      </span>
                    )}
                  </ComboboxOption>
                ))
              )}
            </Transition>
          </div>
        </div>
      )}
    </Combobox>
  );
}
