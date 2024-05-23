import { css } from "styled-components";

export type ThemeColor = "disabled" | "primary" | "primaryLight" | "black" | "white" | "gray" | "lightGray";

export const THEME_COLORS: Record<ThemeColor, string> = {
  primary: "#46b955",
  primaryLight: "#F0FDF4",
  black: "#000",
  white: "#fff",
  gray: "#4B5563",
  lightGray: "#9ca3af",
  disabled: "#D1D5DB"
} as const;

export type FontColor = "primary" | "text.primary" | "text.secondary" | "text.light" | "disabled";

const FONT_COLORS: Record<FontColor, string> = {
  ["text.primary"]: THEME_COLORS.black,
  ["text.secondary"]: THEME_COLORS.gray,
  ["text.light"]: THEME_COLORS.lightGray,
  primary: THEME_COLORS.primary,
  disabled: THEME_COLORS.disabled
};

export const FontColorStyle = css<{ $color?: FontColor }>`
  ${(props) => {
    const color = props.$color || "text.primary";
    return `
      color: ${FONT_COLORS[color]};
    `;
  }}
`;
