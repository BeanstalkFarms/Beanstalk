import { css } from "styled-components";

export type ThemeColor = "primary" | "black" | "white" | "gray" | "lightGray";

export const THEME_COLORS: Record<ThemeColor, string> = {
  primary: "#46b955",
  black: "#000",
  white: "#fff",
  gray: "#4B5563",
  lightGray: "#9ca3af"
} as const;

export type FontColor = "primary" | "black" | "white" | "gray";

export const getFontColorStyles = (color: FontColor) => css`
  color: ${THEME_COLORS[color]};
`;
