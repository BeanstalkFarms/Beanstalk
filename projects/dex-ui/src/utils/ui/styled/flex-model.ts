import type { CSSProperties } from "react";
import { css } from "styled-components";
import { theme } from "../theme";

type FlexModelDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type FlexModelProps = {
  $display?: CSSProperties["display"];
  $direction?: FlexModelDirection;
  $alignItems?: CSSProperties["alignItems"];
  $justifyContent?: CSSProperties["justifyContent"];
  $gap?: number;
  $width?: string;
  $fullWidth?: boolean;
};

export const FlexBase = css<FlexModelProps>`
  display: ${(props) => props.$display || "flex"};
  flex-direction: ${(props) => props.$direction || "column"};
  ${(props) => (props.$alignItems ? `align-items: ${props.$alignItems};` : "")}
  ${(props) => (props.$justifyContent ? `justify-content: ${props.$justifyContent};` : "")}
  ${(props) => (props.$gap ? `gap: ${theme.spacing(props.$gap)};` : "")}
  ${(props) => (props.$fullWidth ? "width: 100%;" : props.$width ? `width: ${props.$width};` : "")}
`;
