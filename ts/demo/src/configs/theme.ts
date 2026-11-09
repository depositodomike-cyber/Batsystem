import { colors } from "@/constants/colors";
import {
  DarkColor,
  LightColor,
  PrimaryColor,
  ThemeConfig,
} from "./@types/theme";

const DEFAULT_DARK_COLOR: DarkColor = "black";
const DEFAULT_LIGHT_COLOR: LightColor = "slate";
const DEFAULT_PRIMARY_COLOR: PrimaryColor = "rose"; // "vermelho" nas configurações de tema

// Default theme configuration
export const defaultTheme: ThemeConfig = {
  themeMode: "dark",
  isMonochrome: false,
  themeLayout: "sideblock",
  cardSkin: "bordered",

  darkColorScheme: {
    name: DEFAULT_DARK_COLOR,
    ...colors[DEFAULT_DARK_COLOR],
  },

  lightColorScheme: {
    name: DEFAULT_LIGHT_COLOR,
    ...colors[DEFAULT_LIGHT_COLOR],
  },

  primaryColorScheme: {
    name: DEFAULT_PRIMARY_COLOR,
    ...colors[DEFAULT_PRIMARY_COLOR],
  },

  notification: {
    isExpanded: false,
    position: "bottom-right",
    visibleToasts: 4,
  },
};
