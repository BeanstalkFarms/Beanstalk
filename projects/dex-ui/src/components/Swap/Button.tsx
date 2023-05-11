import React from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { Spinner } from "../Spinner";

type Props = {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
};

type ButtonProps = {
  // why the $? https://styled-components.com/docs/api#transient-props
  $loading: boolean;
};

export const Button: FC<Props> = ({ label, disabled, loading, onClick }) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled} $loading={loading}>
      {loading ? <Spinner size={20} /> : label}
    </StyledButton>
  );
};

const StyledButton = styled.button<ButtonProps>`
  background: ${({ disabled, $loading }) => (disabled ? "#D1D5DB" : $loading ? "#D1D5DB" : "#000")};
  height: 48px;
  border: none;
  color: ${({ disabled, $loading }) => (disabled ? "#fff" : $loading ? "#fff" : "#fff")};

  text-transform: uppercase;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  cursor: pointer;

  :hover {
    outline: ${({ disabled }) => (disabled ? "none" : "2px solid #46b955")};
  }
`;
