import { css } from "styled-components";

export type ThemeColor = "primary" | "primaryLight" | "black" | "white" | "gray" | "lightGray";

export const THEME_COLORS: Record<ThemeColor, string> = {
  primary: "#46b955",
  primaryLight: "#F0FDF4",
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

export const FontColorStyle = css<{ $color?: FontColor }>`
  ${(props) => {
    const color = props.$color || "text.primary";
    return `
      color: ${FONT_COLORS[color]};
    `;
  }}
`;
