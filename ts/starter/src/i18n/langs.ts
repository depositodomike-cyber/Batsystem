export const locales = {
  pt: {
    label: "Português",
    dayjs: () => import("dayjs/locale/pt-br"),
    flatpickr: () =>
      import("flatpickr/dist/l10n/pt").then((module) => module.Portuguese),
    i18n: () => import("./locales/pt/translations.json"),
    flag: "brazil",
  },
  en: {
    label: "English",
    dayjs: () => import("dayjs/locale/en"),
    flatpickr: null,
    i18n: () => import("./locales/en/translations.json"),
    flag: "united-kingdom",
  },
  ar: {
    label: "Arabic",
    dayjs: () => import("dayjs/locale/ar"),
    flatpickr: () =>
      import("flatpickr/dist/l10n/ar").then((module) => module.Arabic),
    i18n: () => import("./locales/ar/translations.json"),
    flag: "saudi",
  },
};

export const supportedLanguages = Object.keys(locales);

export type LocaleCode = keyof typeof locales;

export type Dir = "ltr" | "rtl";

/** Idiomas expostos no seletor do sidebar (PT / EN). */
export const sidebarLocales: LocaleCode[] = ["pt", "en"];
