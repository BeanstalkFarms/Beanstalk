import { getFontVariantStyles } from "src/components/Typography/components";
import { THEME_COLORS, getFontColorStyles } from "./colors";
import { themeSpacing } from "./spacing";
import { getFontSizeStyles, getFontWeightStyles, getTextAlignStyles } from "./font";

export const theme = {
  colors: THEME_COLORS,
  spacing: themeSpacing,
  font: {
    styles: {
      size: getFontSizeStyles,
      variant: getFontVariantStyles,
      weight: getFontWeightStyles,
      color: getFontColorStyles,
      textAlign: getTextAlignStyles
    }
  }
} as const;
