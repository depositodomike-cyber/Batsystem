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
import { Avatar, Tag, Input } from "@/components/ui";
import { allUsers } from "../../data";

// Types
interface User {
  uid: string;
  name: string;
  avatar?: string;
  text?: string;
}

interface AssignsFieldProps {
  onChange: (users: User[]) => void;
  value: User[];
  name: string;
}

// ----------------------------------------------------------------------

export function AssignsField({ onChange, value, name }: AssignsFieldProps) {
  const [query, setQuery] = useState("");
  const users = allUsers || [];

  const filteredMembers =
    query === ""
      ? users
      : users.filter((user) =>
          user.name
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(query.toLowerCase().replace(/\s+/g, "")),
        );

  const removeItem = (uid: string) => {
    const newValue = value.filter((item: User) => item.uid !== uid);
    onChange(newValue);
  };

  return (
    <Combobox
      value={value || null}
      onChange={onChange}
      name={name}
      by={(a, b) => a?.uid === b?.uid}
      multiple
    >
      {({ open }) => (
        <div className="relative">
          <Label>Assigned To:</Label>

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
              {value.length > 0 ? (
                value.map((user: User) => (
                  <li key={user.uid}>
                    <Tag
                      onClick={() => removeItem(user.uid)}
                      component="button"
                      type="button"
                      variant="outlined"
                      className="flex h-6 rounded-full p-px align-top"
                    >
                      <Avatar
                        size={5.5}
                        src={user.avatar}
                        name={user.name}
                        initialColor="auto"
                        classNames={{ display: "text-tiny" }}
                      />
                      <span className="mx-2">{user.name}</span>
                    </Tag>
                  </li>
                ))
              ) : (
                <span className="dark:text-dark-300 h-6 text-gray-400 italic">
                  Unassigned
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
                displayValue={(user: User) => user?.text || ""}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                autoComplete="off"
                placeholder="Select Members"
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
              {filteredMembers.length === 0 && query !== "" ? (
                <div className="dark:text-dark-100 relative cursor-default px-4 py-2 text-gray-800 select-none">
                  Nothing found for {query}
                </div>
              ) : (
                filteredMembers.map((user) => (
                  <ComboboxOption
                    key={user.uid}
                    className={({ selected, active }) =>
                      clsx(
                        "relative cursor-pointer px-3 py-2 outline-hidden transition-colors select-none",
                        (active || selected) &&
                          "dark:text-dark-100 text-gray-800",
                        active && !selected && "dark:bg-dark-600 bg-gray-100",
                        selected && "dark:bg-dark-500 bg-gray-200",
                      )
                    }
                    value={user}
                  >
                    {({ selected }) => (
                      <span className="flex items-center justify-between">
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar
                            size={6}
                            name={user.name}
                            src={user.avatar}
                            initialColor="auto"
                            classNames={{ display: "text-tiny-plus" }}
                          />
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {user.name}
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
