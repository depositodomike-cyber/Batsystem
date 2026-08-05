// Import Dependencies
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";

// Local Imports
import { Spinner } from "@/components/ui";
import { useLocaleContext } from "@/app/contexts/locale/context";
import { locales, sidebarLocales, type LocaleCode } from "@/i18n/langs";

// ----------------------------------------------------------------------

const options = sidebarLocales.map((code) => ({
  value: code,
  label: locales[code].label,
  flag: locales[code].flag,
}));

export function LanguageSelect() {
  const [loading, setLoading] = useState(false);
  const { locale, updateLocale } = useLocaleContext();

  const selected: LocaleCode = sidebarLocales.includes(locale)
    ? locale
    : "pt";

  const onLanguageSelect = async (lang: LocaleCode) => {
    if (lang === selected) return;
    setLoading(true);
    try {
      await updateLocale(lang);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-200 px-3 py-3 dark:border-dark-600">
      <Listbox as="div" value={selected} onChange={onLanguageSelect}>
        <div className="relative">
          <ListboxButton
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs-plus tracking-wide outline-hidden transition-colors",
              "hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-primary-500/50",
              "dark:border-dark-600 dark:bg-dark-800 dark:hover:border-dark-500",
            )}
          >
            {loading ? (
              <Spinner color="primary" className="size-5 shrink-0" />
            ) : (
              <img
                className="size-5 shrink-0"
                src={`/images/flags/svg/rounded/${locales[selected].flag}.svg`}
                alt=""
              />
            )}
            <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-dark-100">
              {locales[selected].label}
            </span>
            <ChevronUpDownIcon className="size-4 shrink-0 text-gray-400 dark:text-dark-300" />
          </ListboxButton>

          <Transition
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <ListboxOptions
              anchor={{ to: "top start", gap: 8 }}
              className="z-101 w-[var(--button-width)] min-w-[11rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/50 outline-hidden dark:border-dark-500 dark:bg-dark-700 dark:shadow-none"
            >
              {options.map((lang) => (
                <ListboxOption
                  key={lang.value}
                  value={lang.value}
                  className={({ selected: isSelected, focus }) =>
                    clsx(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs-plus tracking-wide transition-colors select-none",
                      focus && !isSelected && "bg-gray-100 dark:bg-dark-600",
                      isSelected
                        ? "bg-primary-600 text-white dark:bg-primary-500"
                        : "text-gray-800 dark:text-dark-100",
                    )
                  }
                >
                  <img
                    className="size-5 shrink-0"
                    src={`/images/flags/svg/rounded/${lang.flag}.svg`}
                    alt=""
                  />
                  <span className="truncate font-medium">{lang.label}</span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}
