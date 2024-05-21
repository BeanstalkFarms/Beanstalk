import { css } from "styled-components";

export type FontWeight = "normal" | "semi-bold" | "bold";

export type TextAlign = "left" | "center" | "right" | "inherit";

export type FontSize = "xxl" | "xl" | "l" | "s" | "xs";

export type FontVariant = "h1" | "h2" | "l" | "s" | "xs" | "button-link";

const FONT_SIZE_MAP = {
  xxl: 48,
  xl: 24,
  l: 20,
  s: 16,
  xs: 14
};

export const getFontSizeStyles = (size: FontSize | number) => {
  if (typeof size === "number") {
    return css`
      font-size: ${size}px;
    `;
  }

  return css`
    font-size: ${typeof size === "number" ? size : FONT_SIZE_MAP[size in FONT_SIZE_MAP ? size : "s"]}px;
  `;
};

export const getFontWeightStyles = (weight: FontWeight) => {
  return css`
    font-weight: ${() => {
      switch (weight) {
        case "normal":
          return 400;
        case "semi-bold":
          return 600;
        case "bold":
          return 700;
        default:
          return 400;
      }
    }};
  `;
};

export const getTextAlignStyles = (align: TextAlign) => {
  return css`
    text-align: ${align};
  `;
};
