import { getFontVariantStyles } from "src/components/Typography/components";
import { THEME_COLORS } from "./colors";
import { themeSpacing } from "./spacing";
import { getFontSize, getTextAlignStyles } from "./font";

export const theme = {
  colors: THEME_COLORS,
  spacing: themeSpacing,
  font: {
    styles: {
      variant: getFontVariantStyles,
      textAlign: getTextAlignStyles
    },
    size: getFontSize
  }
} as const;
