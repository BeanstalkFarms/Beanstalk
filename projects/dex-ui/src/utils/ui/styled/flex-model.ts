import { css } from "styled-components";
import { theme } from "../theme";

type FlexModelDirection = "row" | "column" | "row-reverse" | "column-reverse";

type FlexAlignment =
  | "center"
  | "start"
  | "end"
  | "flex-start"
  | "flex-end"
  | "self-start"
  | "self-end"
  | "baseline"
  | "stretch"
  | "space-between"
  | "space-around"
  | "space-evenly";

type FlexJustifyContent =
  | FlexAlignment
  | "normal"
  | "first baseline"
  | "last baseline"
  | "safe center"
  | "unsafe center"
  | "inherit"
  | "initial"
  | "unset";

type FlexAlignItems =
  | FlexAlignment
  | "normal"
  | "baseline"
  | "first baseline"
  | "last baseline"
  | "safe center"
  | "unsafe center"
  | "inherit"
  | "initial"
  | "unset";

type FlexAlignContent = FlexAlignment | "normal" | "inherit" | "initial" | "unset";

type FlexWrapItems = "nowrap" | "wrap" | "wrap-reverse" | "inherit" | "initial" | "unset";

type DisplayType = "flex" | "block" | "inline" | "inline-block" | "none" | "inline-flex";

export type FlexModelProps = {
  $display?: DisplayType;
  $flex?: boolean;
  $direction?: FlexModelDirection;
  $alignItems?: FlexAlignItems;
  $justifyContent?: FlexJustifyContent;
  $alignContent?: FlexAlignContent;
  $flexWrap?: FlexWrapItems;
  $gap?: number;
  $width?: string;
  $fullWidth?: boolean;
};

export const FlexBase = css<FlexModelProps>`
  display: ${(props) => props.$display || "flex"};
  flex-direction: ${(props) => props.$direction || "column"};
  ${(props) => (props.$alignItems ? `align-items: ${props.$alignItems};` : "")}
  ${(props) => (props.$justifyContent ? `justify-content: ${props.$justifyContent};` : "")}
  ${(props) => (props.$alignContent ? `align-content: ${props.$alignContent};` : "")}
  ${(props) => (props.$flexWrap ? `flex-wrap: ${props.$flexWrap};` : "")}
  ${(props) => (props.$gap ? `gap: ${theme.spacing(props.$gap)};` : "")}
  ${(props) => (props.$fullWidth ? "width: 100%;" : props.$width ? `width: ${props.$width};` : "")}
`;
