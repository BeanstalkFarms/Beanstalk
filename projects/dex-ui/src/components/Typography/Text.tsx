import React, { forwardRef } from "react";
import type { HTMLAttributes, ElementType, CSSProperties } from "react";
import {
  BoxModelBase,
  BoxModelProps,
  FlexPropertiesBase,
  FlexPropertiesProps
} from "src/utils/ui/styled";
import { BlockDisplayStyle, DisplayStyleProps } from "src/utils/ui/styled/common";
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
import { ResponsiveTextProps } from "./typography-components";

export interface TextProps
  extends HTMLAttributes<HTMLDivElement>,
    BoxModelProps,
    CssProps,
    ResponsiveTextProps,
    FlexPropertiesProps,
    DisplayStyleProps {
  $variant?: FontVariant;
  $weight?: FontWeight;
  $color?: FontColor;
  $size?: FontSize;
  $lineHeight?: number | FontSize;
  $align?: TextAlign;
  $textDecoration?: CSSProperties["textDecoration"];
  as?: ElementType;
  className?: string;
  $mobileVariant?: FontVariant;
  $whitespace?: CSSProperties["whiteSpace"];
}

export const Text = forwardRef<HTMLDivElement, TextProps>((props, ref) => {
  return (
    <TextComponent ref={ref} $responsive={props.$responsive !== false ? true : false} {...props} />
  );
});

const TextComponent = styled.div<TextProps>`
  ${(props) => theme.font.styles.variant(props.$variant || "s")}
  ${FontSizeStyle}
  ${LineHeightStyle}
  ${FontWeightStyle}
  ${TextAlignStyle}
  ${FontColorStyle}
  ${BoxModelBase}
  ${BlockDisplayStyle}
  ${FlexPropertiesBase}
  ${(props) => props.$textDecoration && `text-decoration: ${props.$textDecoration};`}
  ${(props) => props.$whitespace && `white-space: ${props.$whitespace};`}
  ${(props) => (props.$css ? props.$css : "")}
`;
