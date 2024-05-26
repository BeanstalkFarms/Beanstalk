import { size } from "src/breakpoints";
import { AdditionalCssBase, BoxModelBase, BoxModelProps } from "src/utils/ui/styled";
import { BlockDisplayStyle, DisplayStyleProps } from "src/utils/ui/styled/common";
import { FlexModelProps, FlexBase } from "src/utils/ui/styled/flex-model";
import { theme } from "src/utils/ui/theme";

import { CssProps } from "src/utils/ui/theme/types";
import styled from "styled-components";

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

export type BoxProps = BoxModelProps & DisplayStyleProps & CssProps;

export const Box = styled.div<BoxProps>`
  ${BlockDisplayStyle}
  ${BoxModelBase}
  ${AdditionalCssBase}
`;

export type FlexProps = BoxModelProps & FlexModelProps & CssProps;

export const Flex = styled.div<FlexProps>`
  ${FlexBase}
  ${BoxModelBase}
  ${AdditionalCssBase}
`;

export const Divider = styled.div<{ $color?: keyof typeof theme.colors }>`
  width: 100%;
  border-bottom: 1px solid ${(props) => theme.colors[props.$color || "lightGray"]};
`;
