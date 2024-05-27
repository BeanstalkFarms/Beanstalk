import type { CSSProperties } from "react";
import { css } from "styled-components";
import { theme } from "../theme";
import { DimensionStyleProps, DimensionStyles, DisplayStyleProps } from "./common";

type FlexModelDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type FlexModelProps = {
  $direction?: FlexModelDirection;
  $alignItems?: CSSProperties["alignItems"];
  $justifyContent?: CSSProperties["justifyContent"];
  $gap?: number;
  $width?: string;
  $fullWidth?: boolean;
} & DimensionStyleProps &
  DisplayStyleProps;

export const FlexBase = css<FlexModelProps>`
  display: ${(props) => props.display || "flex"};
  flex-direction: ${(props) => props.$direction || "column"};
  ${(props) => (props.$alignItems ? `align-items: ${props.$alignItems};` : "")}
  ${(props) => (props.$justifyContent ? `justify-content: ${props.$justifyContent};` : "")}
  ${(props) => (props.$gap ? `gap: ${theme.spacing(props.$gap)};` : "")}
  ${DimensionStyles}
  ${(props) => (props.$fullWidth ? "width: 100%;" : "")}
`;
