import { exists } from "src/utils/check";
import type { CSSProperties } from "react";
import { css } from "styled-components";
import { theme } from "../theme";
import { CommonCssProps, CommonCssStyles, makeCssStyle } from "./common";

type FlexModelDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type FlexPropertiesProps = {
  $flex?: CSSProperties["flex"];
  $flexFlow?: CSSProperties["flexFlow"];
  $direction?: FlexModelDirection;
  $flexShrink?: CSSProperties["flexShrink"];
  $flexGrow?: CSSProperties["flexGrow"];
  $flexBasis?: CSSProperties["flexBasis"];
  $alignItems?: CSSProperties["alignItems"];
  $alignSelf?: CSSProperties["alignSelf"];
  $alignContent?: CSSProperties["alignContent"];
  $justifySelf?: CSSProperties["justifySelf"];
  $justifyContent?: CSSProperties["justifyContent"];
  $justifyItems?: CSSProperties["justifyItems"];
  $order?: CSSProperties["order"];
  $gap?: number;
  $rowGap?: number;
  $columnGap?: number;
};

export const FlexPropertiesStyle = css<FlexPropertiesProps>`
  ${(p) => makeCssStyle(p, "$flex")}
  ${(p) => makeCssStyle(p, "$flexShrink")}
  ${(p) => makeCssStyle(p, "$flexFlow")}
  ${(p) => makeCssStyle(p, "$flexGrow")}
  ${(p) => makeCssStyle(p, "$flexBasis")}
  ${(p) => makeCssStyle(p, "$alignItems")}
  ${(p) => makeCssStyle(p, "$alignSelf")}
  ${(p) => makeCssStyle(p, "$alignContent")}
  ${(p) => makeCssStyle(p, "$justifySelf")}
  ${(p) => makeCssStyle(p, "$justifyContent")}
  ${(p) => makeCssStyle(p, "$justifyItems")}
  ${(p) => makeCssStyle(p, "$order")}
  ${(p) => makeCssStyle(p, "$direction")}
  ${(p) => (exists(p.$gap) ? `gap: ${theme.spacing(p.$gap)};` : "")}
  ${(p) => (exists(p.$rowGap) ? `row-gap: ${theme.spacing(p.$rowGap)};` : "")}
  ${(p) => (exists(p.$columnGap) ? `column-gap: ${theme.spacing(p.$columnGap)};` : "")}
`;

export type FlexModelProps = FlexPropertiesProps &
  CommonCssProps & {
    $fullWidth?: boolean;
  };

export const FlexBase = css<FlexModelProps>`
  ${FlexPropertiesStyle}
  display: ${(p) => p.$display || "flex"};
  flex-direction: ${(p) => p.$direction || "column"};
  ${CommonCssStyles}
  ${(p) => (p.$fullWidth ? "width: 100%;" : "")}
`;
