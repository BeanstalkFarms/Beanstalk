import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { Spinner } from "../Spinner";
import { BodyXS } from "../Typography";
import { size } from "src/breakpoints";

type Props = {
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  width?: string;
  margin?: string;
  secondary?: boolean;
};

export const Button: FC<Props> = ({
  label = "Button",
  disabled = false,
  loading = false,
  onClick = () => {},
  width = "100%",
  margin = "0",
  secondary = false
}) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled} $loading={loading} $width={width} margin={margin} secondary={secondary}>
      {loading ? <Spinner size={18} /> : label}
    </StyledButton>
  );
};

type ButtonProps = {
  // why the $? https://styled-components.com/docs/api#transient-props
  $loading: boolean;
  $width: string;
  secondary: boolean;
  margin: string;
};

const StyledButton = styled.button<ButtonProps>`
  background: ${({ disabled, $loading, secondary }) => {
    if (disabled || $loading) return "#D1D5DB";
    if (secondary) return "#F9F8F6";
    return "#000";
  }};
  height: 48px;
  border: none;
  outline: ${({ secondary, disabled }) => (secondary ? "0.5px solid #9CA3AF" : disabled ? "0.5px solid #D1D5DB" : "0.5px solid #000")};
  outline-offset: -0.5px;
  color: ${({ secondary }) => (secondary ? "#000" : "#FFF")};
  width: ${({ $width }) => $width};
  margin: ${({ margin }) => margin};

  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  cursor: pointer;

  :hover {
    outline: ${({ disabled }) => (disabled ? "0.5px solid #D1D5DB" : "2px solid #46b955")};
  }

  :focus {
    outline: 2px solid #46b955;
  }

  @media (max-width: ${size.mobile}) {
    ${BodyXS}
    font-weight: 600;
    padding: 8px 8px;
    height: 48x;
  }
`;
