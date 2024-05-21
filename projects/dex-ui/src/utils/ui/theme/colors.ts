import { css } from "styled-components";

export type ThemeColor = "primary" | "black" | "white" | "gray" | "lightGray";

export const THEME_COLORS: Record<ThemeColor, string> = {
  primary: "#46b955",
  black: "#000",
  white: "#fff",
  gray: "#4B5563",
  lightGray: "#9ca3af"
} as const;

export type FontColor = "primary" | "text.primary" | "text.secondary";

const FONT_COLORS: Record<FontColor, string> = {
  ["text.primary"]: THEME_COLORS.black,
  ["text.secondary"]: THEME_COLORS.gray,
  primary: THEME_COLORS.primary
};

export const getFontColorStyles = (color: FontColor) => css`
  color: ${FONT_COLORS[color]};
`;
