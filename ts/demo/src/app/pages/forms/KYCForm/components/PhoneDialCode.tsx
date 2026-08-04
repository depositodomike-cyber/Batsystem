// Import Dependencies
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Transition,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Fragment } from "react";

// Local Imports
import { Input } from "@/components/ui";
import { countries, Country } from "@/constants/countries";
import { useFuse } from "@/hooks";

// ----------------------------------------------------------------------

interface PhoneDialCodeProps {
  onChange: (dialCode: string | undefined) => void;
  value?: string;
  name?: string;
  error?: boolean | string;
}

export function PhoneDialCode({
  onChange,
  value,
  name,
  error,
}: PhoneDialCodeProps) {
  const {
    result: filteredValues,
    query,
    setQuery,
  } = useFuse(countries, {
    keys: ["name", "dialCode"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Combobox
      as="div"
      value={countries.find((country) => country.dialCode === value) || null}
      onChange={(val) => onChange(val?.dialCode)}
      name={name}
    >
      {({ open, value: selectedValue }) => (
        <>
          <div className="relative w-32">
            <div className="relative w-full cursor-pointer overflow-hidden">
              <ComboboxInput
                as={Input}
                autoComplete="off"
                className={clsx(
                  "hover:z-1 focus:z-1 ltr:rounded-r-none rtl:rounded-l-none",
                  selectedValue && "ltr:pr-8 ltr:pl-12 rtl:pr-12 rtl:pl-8",
                )}
                error={error}
                displayValue={(val: Country) => val?.dialCode}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Dial Code"
                suffix={
                  <ComboboxButton className="z-1">
                    <ChevronDownIcon
                      className={clsx(
                        "dark:text-dark-300 size-5 text-gray-400 transition-transform",
                        open && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </ComboboxButton>
                }
              />

              {selectedValue && (
                <div className="pointer-events-none absolute inset-y-0 flex items-center ltr:left-0 ltr:pl-3 rtl:right-0 rtl:pr-3">
                  <img
                    className="h-4.5 w-7 rounded-xs object-cover object-center"
                    src={`/images/flags/png/${selectedValue.code.toLowerCase()}.png`}
                    alt={selectedValue.name}
                  />
                </div>
              )}
            </div>
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
              <ComboboxOptions className="dark:border-dark-500 dark:bg-dark-750 absolute z-10 mt-1 max-h-60 min-w-full overflow-x-hidden overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 whitespace-nowrap shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden dark:shadow-none">
                {filteredValues.length === 0 && query !== "" ? (
                  <div className="dark:text-dark-100 relative cursor-default px-3 py-2 text-gray-800 select-none">
                    Nothing found for {query}
                  </div>
                ) : (
                  filteredValues.map(({ item: country }) => (
                    <ComboboxOption
                      title={country.name}
                      key={country.code}
                      className={({ selected, focus }) =>
                        clsx(
                          "relative cursor-pointer px-3 py-2 outline-hidden transition-colors select-none",
                          focus && !selected && "dark:bg-dark-600 bg-gray-100",
                          selected
                            ? "bg-primary-600 dark:bg-primary-500 text-white"
                            : "dark:text-dark-100 text-gray-800",
                        )
                      }
                      value={country}
                    >
                      <div className="flex items-center justify-between space-x-1">
                        <div className="flex items-center space-x-3">
                          <img
                            className="h-4.5 w-7 rounded-xs object-cover object-center"
                            src={`/images/flags/png/${country.code.toLowerCase()}.png`}
                            alt={country.name}
                          />
                          <span>{country.dialCode} </span>
                        </div>
                        <span className="text-xs opacity-60">
                          ({country.code})
                        </span>
                      </div>
                    </ComboboxOption>
                  ))
                )}
              </ComboboxOptions>
            </Transition>
          </div>
        </>
      )}
    </Combobox>
  );
}
