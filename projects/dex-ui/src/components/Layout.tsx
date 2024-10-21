import styled from "styled-components";

import { size } from "src/breakpoints";
import { AdditionalCssBase, BoxModelBase } from "src/utils/ui/styled";
import { CommonCssProps, CommonCssStyles } from "src/utils/ui/styled/common";
import { FlexModelProps, FlexBase } from "src/utils/ui/styled/flex-model";
import { theme } from "src/utils/ui/theme";
import { CssProps } from "src/utils/ui/theme/types";

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

export type BoxProps = CommonCssProps & CssProps;

export const Box = styled.div<BoxProps>`
  ${BoxModelBase}
  ${CommonCssStyles}
  ${AdditionalCssBase}
`;

export type FlexProps = FlexModelProps & CssProps;

export const Flex = styled.div<FlexProps>`
  ${FlexBase}
  ${BoxModelBase}
  ${AdditionalCssBase}
`;

export const Divider = styled.div<{ $color?: keyof typeof theme.colors }>`
  width: 100%;
  border-bottom: 1px solid ${(props) => theme.colors[props.$color || "lightGray"]};
`;

export type FlexCardProps = FlexProps & {
  $borderColor?: keyof typeof theme.colors;
  $bgColor?: keyof typeof theme.colors;
  $borderWidth?: number;
};

export const FlexCard = styled(Flex)<
  FlexProps & {
    $borderColor?: keyof typeof theme.colors;
    $borderWidth?: number;
    $bgColor?: keyof typeof theme.colors;
  }
>`
  border: ${(p) => p.$borderWidth ?? 1}px solid ${(p) => theme.colors[p.$borderColor || "black"]};
  background: ${(p) => theme.colors[p.$bgColor || "white"]};
  ${(p) => {
    if (p.$p || p.$px || p.$py || p.$pt || p.$pr || p.$pb || p.$pl) {
      return "";
    } else {
      return `padding: ${theme.spacing(2, 3)};`;
    }
  }}
`;
