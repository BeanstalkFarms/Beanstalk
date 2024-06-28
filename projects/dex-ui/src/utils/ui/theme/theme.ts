import { THEME_COLORS, getFontColor } from "./colors";
import { themeSpacing } from "./spacing";
import { getFontSize, getFontVariantStyles, getTextAlignStyles } from "./font";
import { mediaQuery, size } from "src/breakpoints";

export const theme = {
  colors: THEME_COLORS,
  spacing: themeSpacing,
  font: {
    styles: {
      variant: getFontVariantStyles,
      textAlign: getTextAlignStyles
    },
    color: getFontColor,
    size: getFontSize
  },
  media: {
    size: size,
    query: mediaQuery
  }
} as const;
