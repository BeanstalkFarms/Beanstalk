import React, { HTMLAttributes } from "react";
import { size } from "src/breakpoints";
import { theme } from "src/utils/ui/theme";
import { CssProps } from "src/utils/ui/theme/types";
import styled, { FlattenSimpleInterpolation } from "styled-components";

export const Item = styled.div<{ stretch?: boolean; right?: boolean; column?: boolean }>`
  display: flex;
  ${({ column }) => column && "flex-direction: column;"}
  ${({ stretch }) => stretch && "flex: 2;"}
  ${({ right, column }) => right && (column ? "align-items: end;" : "justify-content: right;")}
`;

export const Row = styled.div<{ gap?: number; mobileGap?: string }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  ${({ gap }) => gap && `gap: ${gap}px;`}

  @media (max-width: ${size.mobile}) {
    ${({ gap, mobileGap }) => (mobileGap ? `gap: ${mobileGap};` : `gap: ${gap}px;`)}
  }
`;

export interface FlexProps extends HTMLAttributes<HTMLElement> {
  direction?: "row" | "column";
  alignItems?: "center" | "flex-start" | "flex-end";
  justifyContent?: "center" | "flex-start" | "flex-end" | "space-between" | "space-around";
  gap?: number;
  fullWidth?: boolean;
  css?: FlattenSimpleInterpolation;
}

export const Flex = ({ direction, alignItems, justifyContent, gap, fullWidth, css, ...rest }: FlexProps) => {
  return (
    <FlexComponent
      $direction={direction}
      $alignItems={alignItems}
      $gap={gap}
      $justifyContent={justifyContent}
      $fullWidth={fullWidth}
      css={css}
      {...rest}
    />
  );
};

const FlexComponent = styled.div<{
  $direction?: "row" | "column";
  $alignItems?: "center" | "flex-start" | "flex-end";
  $justifyContent?: "center" | "flex-start" | "flex-end" | "space-between" | "space-around";
  $gap?: number;
  $fullWidth?: boolean;
  css?: FlattenSimpleInterpolation;
}>`
  display: flex;
  flex-direction: ${(props) => props.$direction ?? "column"};
  ${(props) => props.$alignItems && `align-items: ${props.$alignItems};`}
  ${(props) => props.$justifyContent && `justify-content: ${props.$justifyContent};`}
  ${(props) => props.$gap && `gap: ${theme.spacing(props.$gap)}`}
  ${(props) => props.$fullWidth && "width: 100%;"}
  ${(props) => props.css && props.css}
`;

export type StyledDivProps = HTMLAttributes<HTMLDivElement> & CssProps;

export const StyledDiv = (props: StyledDivProps) => <StyledDivComponent {...props} $css={props.css} />;
const StyledDivComponent = styled.div<{ $css?: FlattenSimpleInterpolation }>`
  ${(props) => props.$css}
`;
