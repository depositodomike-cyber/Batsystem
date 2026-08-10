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
  es: {
    label: "Spanish",
    dayjs: () => import("dayjs/locale/es"),
    flatpickr: () =>
      import("flatpickr/dist/l10n/es").then((module) => module.Spanish),
    i18n: () => import("./locales/es/translations.json"),
    flag: "spain",
  },
  "zh-cn": {
    label: "Chinese",
    dayjs: () => import("dayjs/locale/zh-cn"),
    flatpickr: () =>
      import("flatpickr/dist/l10n/zh").then((module) => module.Mandarin),
    i18n: () => import("./locales/zh_cn/translations.json"),
    flag: "china",
  },
};

export const supportedLanguages = Object.keys(locales);

export type LocaleCode = keyof typeof locales;

export type Dir = "ltr" | "rtl";

/** Idiomas expostos no seletor do menu de perfil (PT / EN). */
export const profileLocales: LocaleCode[] = ["pt", "en"];

/** @deprecated use profileLocales */
export const sidebarLocales = profileLocales;
