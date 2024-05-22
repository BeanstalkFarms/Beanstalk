import { exists } from "src/utils/check";
import { css } from "styled-components";

export type FontWeight = "normal" | "semi-bold" | "bold";

export type TextAlign = "left" | "center" | "right" | "inherit";

export type FontSize = "h1" | "h2" | "h3" | "l" | "s" | "xs";

export type FontVariant = FontSize | "button-link";

const FONT_SIZE_MAP = {
  h1: 48, // H1
  h2: 32, // H2
  h3: 24, // H3
  l: 20, // BodyL
  s: 16, // BodyS
  xs: 14 // BodyXS
};

/// --------------- Font Size ---------------
export const getFontSize = (_size: number | FontSize) => {
  if (typeof _size === "number") return _size;
  return FONT_SIZE_MAP[_size in FONT_SIZE_MAP ? _size : "s"];
};

export const FontSizeStyle = css<{ $size?: number | FontSize }>`
  ${({ $size }) => {
    if (!exists($size)) return "";
    return `
      font-size: ${getFontSize($size)}px;
    `;
  }}
`;

export const LineHeightStyle = css<{ $lineHeight?: number | FontSize }>`
  ${(props) => {
    if (!exists(props.$lineHeight)) return "";
    return `
      line-height: ${getFontSize(props.$lineHeight)}px;
    `;
  }}
`;

// --------------- Font Weight ---------------
export const getFontWeight = (weight: FontWeight) => {
  switch (weight) {
    case "semi-bold":
      return 600;
    case "bold":
      return 700;
    default:
      return 400;
  }
};

export const FontWeightStyle = css<{ $weight?: FontWeight }>`
  ${(props) => {
    if (!exists(props.$weight)) return "";
    return `
      font-weight: ${getFontWeight(props.$weight)};
    `;
  }}
`;

// --------------- Text Align ---------------
export const TextAlignStyle = css<{ $align?: TextAlign }>`
  ${(props) => {
    if (!exists(props.$align)) return "";
    return `
      text-align: ${props.$align};
    `;
  }}
`;

export const getTextAlignStyles = (align: TextAlign) => {
  return css`
    text-align: ${align};
  `;
};

export const FontUtil = {
  size: getFontSize,
  weight: getFontWeight
};
