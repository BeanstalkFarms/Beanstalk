import { mediaQuery, size } from "src/breakpoints";

import { THEME_COLORS, getFontColor } from "./colors";
import { getFontSize, getFontVariantStyles, getTextAlignStyles } from "./font";
import { themeSpacing } from "./spacing";

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
