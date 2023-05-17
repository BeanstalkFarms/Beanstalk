import React, { MouseEvent as ReactMouseEvent } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { Spinner } from "../Spinner";

type Props = {
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  width?: string;
  secondary?: boolean;
};

export const Button: FC<Props> = ({
  label = "Button",
  disabled = false,
  loading = false,
  onClick = () => {},
  width = "100%",
  secondary = false
}) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled} $loading={loading} $width={width} secondary={secondary}>
      {loading ? <Spinner size={18} /> : label}
    </StyledButton>
  );
};

type ButtonProps = {
  // why the $? https://styled-components.com/docs/api#transient-props
  $loading: boolean;
  $width: string;
  secondary: boolean;
};

const StyledButton = styled.button<ButtonProps>`
  background: ${({ disabled, $loading, secondary }) => {
    if (disabled || $loading) return "#D1D5DB";
    if (secondary) return "#F9F8F6";
    return "#000";
  }};
  height: 48px;
  border: none;
  outline: ${({ secondary }) => (secondary ? "1px solid #9CA3AF" : "0px")};
  outline-offset: ${({ secondary }) => (secondary ? "-1px" : "0px")};
  color: ${({ secondary }) => (secondary ? "#000" : "#FFF")};
  width: ${({ $width }) => $width};

  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  cursor: pointer;

  :hover {
    outline: ${({ disabled }) => (disabled ? "none" : "2px solid #46b955")};
  }
`;
