import type { CSSProperties } from "react";
import { css } from "styled-components";
import { theme } from "../theme";
import { CommonCssProps, CommonCssStyles, makeCssStyle } from "./common";

type FlexModelDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type FlexModelProps = {
  $direction?: FlexModelDirection;
  $alignItems?: CSSProperties["alignItems"];
  $justifyContent?: CSSProperties["justifyContent"];
  $alignSelf?: CSSProperties["alignSelf"];
  $gap?: number;
  $width?: string;
  $fullWidth?: boolean;
} & CommonCssProps;

export const FlexBase = css<FlexModelProps>`
  display: ${(p) => p.$display || "flex"};
  flex-direction: ${(p) => p.$direction || "column"};
  ${(p) => (p.$gap ? `gap: ${theme.spacing(p.$gap)};` : "")}
  ${(p) => makeCssStyle(p, "$alignItems")}
  ${(p) => makeCssStyle(p, "$justifyContent")}
  ${(p) => makeCssStyle(p, "$alignSelf")}
  
  ${CommonCssStyles}
  ${(p) => (p.$fullWidth ? "width: 100%;" : "")}
`;
  