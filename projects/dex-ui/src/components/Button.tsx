import React, { HTMLAttributes, forwardRef } from "react";
import { BoxModelBase, BoxModelProps } from "src/utils/ui/styled";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";

export type ButtonVariant = "outlined" | "contained"; // | "text" (Add Text Variant later)

type BaseButtonProps = {
  $variant?: ButtonVariant;
  disabled?: boolean;
};

export type ButtonProps = HTMLAttributes<HTMLButtonElement> & BoxModelProps & BaseButtonProps;

export const ButtonPrimary = forwardRef<HTMLButtonElement, ButtonProps>((props: ButtonProps, ref) => {
  return <ButtonBase ref={ref} {...props} />;
});

const getButtonFontColor = (props: BaseButtonProps) => {
  if (props.$variant === "outlined") return props.disabled ? theme.colors.disabled : theme.colors.black;
  return theme.colors.white;
};

const getButtonBgColor = (props: BaseButtonProps) => {
  if (props.$variant === "outlined") return theme.colors.white;
  return props.disabled ? theme.colors.disabled : theme.colors.black;
};

const getButtonOutline = (props: BaseButtonProps) => {
  if (props.$variant === "outlined") return props.disabled ? theme.colors.disabled : theme.colors.lightGray;
  return props.disabled ? theme.colors.disabled : theme.colors.black;
};

const ButtonBase = styled.button<ButtonProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  border: 0;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  padding: ${theme.spacing(1.5)};
  ${theme.font.styles.variant("button-link")}
  ${BoxModelBase}
  
  background-color: ${getButtonBgColor};
  color: ${getButtonFontColor};
  outline: 0.5px solid ${getButtonOutline};
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};

  &:hover,
  &:focus {
    outline: ${(props) => (!props.disabled ? `2px solid ${theme.colors.primary}` : "")};
  }
`;
