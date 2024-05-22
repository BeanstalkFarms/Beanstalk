import { HTMLAttributes } from "react";
import { BoxModelBase, BoxModelProps } from "src/utils/ui/styled";
import {
  theme,
  FontWeight,
  FontColor,
  FontVariant,
  FontSize,
  CssProps,
  FontSizeStyle,
  LineHeightStyle,
  FontWeightStyle,
  TextAlignStyle,
  TextAlign,
  FontColorStyle
} from "src/utils/ui/theme";
import styled from "styled-components";

export interface TextProps extends HTMLAttributes<HTMLDivElement>, BoxModelProps, CssProps {
  $variant?: FontVariant;
  $weight?: FontWeight;
  $color?: FontColor;
  $size?: FontSize;
  $lineHeight?: number | FontSize;
  $align?: TextAlign;
}

export const Text = styled.div<TextProps>`
  ${(props) => theme.font.styles.variant(props.$variant || "s")}
  ${FontSizeStyle}
  ${LineHeightStyle}
  ${FontWeightStyle}
  ${TextAlignStyle}
  ${FontColorStyle}
  ${BoxModelBase}
  ${(props) => (props.$css ? props.$css : "")}
`;
