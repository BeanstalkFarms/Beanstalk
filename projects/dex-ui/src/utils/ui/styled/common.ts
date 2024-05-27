import type { CSSProperties } from "react";
import { ThemedStyledProps, css } from "styled-components";

export const makeStyle = <T>(
  props: ThemedStyledProps<T, any>,
  cssKey: string,
  propKey: string
): string => {
  const prop = props[propKey as keyof typeof props];
  return prop ? `${cssKey}: ${prop};` : "";
};

export type DisplayStyleProps = {
  display?: CSSProperties["display"];
};

export const BlockDisplayStyle = css<DisplayStyleProps>`
  ${(p) => makeStyle(p, "display", "$display")}
`;

export type DimensionStyleProps = {
  height?: CSSProperties["height"];
  minHeight?: CSSProperties["minHeight"];
  maxHeight?: CSSProperties["maxHeight"];
  width?: CSSProperties["width"];
  minWidth?: CSSProperties["minWidth"];
  maxWidth?: CSSProperties["maxWidth"];
};

export const DimensionStyles = css<DimensionStyleProps>`
  ${(p) => makeStyle(p, "height", "height")}
  ${(p) => makeStyle(p, "min-height", "minHeight")}
  ${(p) => makeStyle(p, "max-height", "maxHeight")}
  ${(p) => makeStyle(p, "width", "width")}
  ${(p) => makeStyle(p, "min-width", "minWidth")}
  ${(p) => makeStyle(p, "max-width", "maxWidth")}
`;
