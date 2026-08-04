// Import Dependencies
import { Fragment, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Transition,
} from "@headlessui/react";
import clsx from "clsx";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

// Local Imports
import { Input, Tag } from "@/components/ui";

// ----------------------------------------------------------------------

type Person = {
  id: number;
  name: string;
};

const people: Person[] = [
  { id: 1, name: "Wade Cooper" },
  { id: 2, name: "Arlene Mccoy" },
  { id: 3, name: "Devon Webb" },
  { id: 4, name: "Tom Cook" },
  { id: 5, name: "Tanya Fox" },
  { id: 6, name: "Hellen Schmidt" },
];

export function Tags() {
  const [selected, setSelected] = useState<Person[]>([people[0], people[1]]);
  const [query, setQuery] = useState("");

  const filteredPeople =
    query === ""
      ? people
      : people.filter((person) =>
          person.name
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(query.toLowerCase().replace(/\s+/g, "")),
        );

  return (
    <div className="max-w-xl">
      <Combobox
        value={selected}
        onChange={(list) => {
          setSelected(list);
          setQuery("");
        }}
        multiple
      >
        {({ open }) => (
          <div className="relative mt-1">
            <div className="focus-within:border-primary-600! dark:border-dark-450 dark:bg-dark-700 dark:focus-within:border-primary-500! dark:hover:border-dark-400 relative w-full cursor-default overflow-hidden rounded-lg border border-gray-300 bg-white px-3 py-2 text-start outline-hidden transition-colors hover:border-gray-400 focus:outline-hidden ltr:pr-9 rtl:pl-9">
              <ul className="flex flex-wrap gap-1.5">
                {selected.length > 0 &&
                  selected.map((person) => (
                    <li key={person.id}>
                      <Tag
                        onClick={() =>
                          setSelected((current) =>
                            current.filter((p) => p.id !== person.id),
                          )
                        }
                        component="button"
                      >
                        {person.name}
                      </Tag>
                    </li>
                  ))}

                {selected.length === 0 && query === "" && (
                  <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 px-3 py-2 ltr:left-0 rtl:right-0">
                    Select Person
                  </span>
                )}

                <ComboboxInput
                  as={Input}
                  unstyled
                  rootClass="flex-1"
                  displayValue={(person: Person) => person.name}
                  autoComplete="off"
                  onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (
                      selected &&
                      selected.length > 0 &&
                      event.key === "Backspace" &&
                      (event.target as HTMLInputElement).value === ""
                    ) {
                      setSelected((current) => current.slice(0, -1));
                    }
                  }}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  value={query}
                />
              </ul>
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
              as={Fragment}
              enter="transition ease-out"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <ComboboxOptions className="dark:border-dark-500 dark:bg-dark-700 absolute z-10 mt-1 max-h-60 w-full overflow-x-hidden overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden dark:shadow-none">
                {filteredPeople.length === 0 && query !== "" ? (
                  <div className="dark:text-dark-100 relative cursor-default px-4 py-2 text-gray-800 select-none">
                    Nothing found for {query}
                  </div>
                ) : (
                  filteredPeople.map((person) => (
                    <ComboboxOption
                      key={person.id}
                      className={({ selected, active }) =>
                        clsx(
                          "relative cursor-pointer px-4 py-2 outline-hidden transition-colors select-none",
                          active && !selected && "dark:bg-dark-600 bg-gray-100",
                          selected
                            ? "bg-primary-600 dark:bg-primary-500 text-white"
                            : "dark:text-dark-100 text-gray-800",
                        )
                      }
                      value={person}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {person.name}
                          </span>
                        </>
                      )}
                    </ComboboxOption>
                  ))
                )}
              </ComboboxOptions>
            </Transition>
          </div>
        )}
      </Combobox>
    </div>
  );
}
