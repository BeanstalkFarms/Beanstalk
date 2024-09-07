import React, { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

import styled from "styled-components";

import {
  CommonCssProps,
  CommonCssStyles,
  FlexPropertiesStyle,
  FlexPropertiesProps,
  makeCssStyle
} from "src/utils/ui/styled";
import { theme } from "src/utils/ui/theme";

import { Spinner } from "./Spinner";

export type ButtonVariant = "outlined" | "contained"; // | "text" (Add Text Variant later)
export type ButtonColor = "primary" | "secondary";

type BaseButtonProps = {
  $variant?: ButtonVariant;
  disabled?: boolean;
  $loading?: boolean;
  $fullWidth?: boolean;
  $primary?: boolean;
  $secondary?: boolean;
};

type CommonButtonStyles = {
  $whiteSpace?: CSSProperties["whiteSpace"];
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  BaseButtonProps &
  CommonCssProps &
  FlexPropertiesProps &
  CommonButtonStyles;

export const ButtonPrimary = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, $loading, ...props }: ButtonProps, ref) => {
    return (
      <ButtonBase $primary $loading={$loading} ref={ref} {...props}>
        {$loading ? <Spinner size={18} /> : children}
      </ButtonBase>
    );
  }
);

const getButtonFontColor = (props: BaseButtonProps) => {
  if (props.$variant === "outlined") {
    if (props.disabled || props.$loading) return theme.colors.disabled;
    return props.$secondary ? theme.colors.stoneLight : theme.colors.black;
  }

  return props.$secondary ? theme.colors.black : theme.colors.white;
};

const getButtonBgColor = (props: BaseButtonProps) => {
  if (props.$variant === "outlined") return theme.colors.white;
  if (props.disabled || props.$loading) return theme.colors.disabled;
  return props.$secondary ? theme.colors.stoneLight : theme.colors.black;
};

const getButtonOutline = (props: BaseButtonProps) => {
  if (props.disabled) return theme.colors.disabled;
  if (props.$variant === "outlined") {
    return props.$secondary ? theme.colors.lightGray : theme.colors.black;
  }
  return theme.colors.black;
};

const ButtonBase = styled.button<ButtonProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${theme.spacing(1.5)};
  box-sizing: border-box;

  border: none;
  background: ${getButtonBgColor};
  outline: 0.5px solid ${getButtonOutline};
  outline-offset: -0.5px;
  color: ${getButtonFontColor};
  ${(p) => makeCssStyle(p, "$whiteSpace")}

  ${CommonCssStyles}
  ${FlexPropertiesStyle}
  ${({ $fullWidth }) => $fullWidth && "width: 100%;"}
  
  ${theme.font.styles.variant("button-link")}
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};

  &:hover,
  &:focus {
    outline: ${(props) => (!props.disabled ? `2px solid ${theme.colors.primary}` : "")};
  }

  ${theme.media.query.sm.only} {
    padding: ${theme.spacing(1)};
    ${theme.font.styles.variant("xs")}
  }
`;
