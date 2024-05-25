import { css } from "styled-components";

export type ThemeColor = "errorRed" | "disabled" | "primary" | "primaryLight" | "black" | "white" | "gray" | "lightGray" | "stone";

export const THEME_COLORS: Record<ThemeColor, string> = {
  primary: "#46b955",
  primaryLight: "#F0FDF4",
  black: "#000",
  white: "#fff",
  gray: "#4B5563",
  lightGray: "#9ca3af",
  disabled: "#D1D5DB",
  errorRed: "#DA2C38",
  stone: "#78716c"
} as const;

export type FontColor = "error" | "primary" | "text.primary" | "text.secondary" | "text.light" | "disabled";

export const FONT_COLORS: Record<FontColor, string> = {
  ["text.primary"]: THEME_COLORS.black,
  ["text.secondary"]: THEME_COLORS.gray,
  ["text.light"]: THEME_COLORS.lightGray,
  primary: THEME_COLORS.primary,
  disabled: THEME_COLORS.disabled,
  error: THEME_COLORS.errorRed
};

export const getFontColor = (color: FontColor) => FONT_COLORS[color];

export const FontColorStyle = css<{ $color?: FontColor }>`
  ${(props) => {
    const color = props.$color || "text.primary";
    return `
      color: ${getFontColor(color)};
    `;
  }}
`;
