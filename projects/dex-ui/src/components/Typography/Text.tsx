import { HTMLAttributes } from "react";
import { BoxModelBase, BoxModelProps } from "src/utils/ui/styled";
import { theme, FontWeight, FontColor, FontVariant, FontSize, CssProps } from "src/utils/ui/theme";
import styled from "styled-components";

export interface TextProps extends HTMLAttributes<HTMLDivElement>, BoxModelProps, CssProps {
  $variant?: FontVariant;
  $weight?: FontWeight;
  $color?: FontColor;
  $size?: FontSize;
}

export const Text = styled.div<TextProps>`
  ${(props) => theme.font.styles.variant(props.$variant || "s")}
  ${(props) => (props.$size ? theme.font.styles.size(props.$size) : "")}
  ${(props) => (props.$weight ? theme.font.styles.weight(props.$weight) : "")}
  ${(props) => (props.$color ? theme.font.styles.color(props.$color || "text.primary") : "")}
  ${(props) => (props.$css ? props.$css : "")}
  ${BoxModelBase}
`;
