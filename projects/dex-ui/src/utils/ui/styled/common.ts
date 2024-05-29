import type { CSSProperties } from "react";
import { ThemedStyledProps, css } from "styled-components";
import { BoxModelBase, BoxModelProps } from "./box-model";

const CSS_PROP_MAP = {
  // display
  $display: "display",

  // dimensions
  $height: "height",
  $minHeight: "min-height",
  $maxHeight: "max-height",
  $width: "width",
  $minWidth: "min-width",
  $maxWidth: "max-width",

  // box
  $boxSizing: "box-sizing",

  // flex
  $direction: "flex-direction",
  $alignItems: "align-items",
  $justifyContent: "justify-content",
  $alignSelf: "align-self",
  $gap: "gap"

  // we can't handle margin / padding here b/c we calculate them differently
};

export const makeCssStyle = <T>(
  props: ThemedStyledProps<T, any>,
  propKey: keyof typeof CSS_PROP_MAP
): string => {
  const prop = props[propKey as keyof typeof props];
  const cssKey = CSS_PROP_MAP[propKey];
  return prop && cssKey ? `${cssKey}: ${prop};` : "";
};

export type DisplayStyleProps = {
  $display?: CSSProperties["display"];
};

export const BlockDisplayStyle = css<DisplayStyleProps>`
  ${(p) => makeCssStyle(p, "$display")}
`;

export type DimensionStyleProps = {
  $height?: CSSProperties["height"];
  $minHeight?: CSSProperties["minHeight"];
  $maxHeight?: CSSProperties["maxHeight"];
  $width?: CSSProperties["width"];
  $minWidth?: CSSProperties["minWidth"];
  $maxWidth?: CSSProperties["maxWidth"];
};

export const DimensionStyles = css<DimensionStyleProps>`
  ${(p) => makeCssStyle(p, "$height")}
  ${(p) => makeCssStyle(p, "$minHeight")}
  ${(p) => makeCssStyle(p, "$maxHeight")}
  ${(p) => makeCssStyle(p, "$width")}
  ${(p) => makeCssStyle(p, "$minWidth")}
  ${(p) => makeCssStyle(p, "$maxWidth")}
`;

export type BoxSizingProps = {
  $boxSizing?: CSSProperties["boxSizing"];
};

export const BoxSizingStyles = css<BoxSizingProps>`
  ${(p) => makeCssStyle(p, "$boxSizing")}
`;

export type CommonCssProps = DimensionStyleProps &
  BoxSizingProps &
  DisplayStyleProps &
  BoxModelProps;

export const CommonCssStyles = css<CommonCssProps>`
  ${DimensionStyles}
  ${BoxSizingStyles}
  ${BlockDisplayStyle}
  ${BoxModelBase}
`;