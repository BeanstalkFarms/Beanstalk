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
  loading: boolean;
};

export const Button: FC<Props> = ({ label, disabled, loading, onClick }) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled} loading={loading}>
      {loading ? <Spinner size={20} /> : label}
    </StyledButton>
  );
};

const StyledButton = styled.button<ButtonProps>`
  background: ${({ disabled, loading }) => (disabled ? "#333335" : loading ? "#3152db" : "#4c6ae9")};
  height: 60px;
  border-radius: 10px;
  outline: none;
  border: none;
  color: ${({ disabled, loading }) => (disabled ? "#575757" : loading ? "#d6dbff" : "#d6dbff")};
  line-height: 1.5rem;
  font-size: 1.5rem;
  cursor: pointer;

  :hover {
    background: ${({ disabled }) => (disabled ? "#333335" : "#3152db")};
  }
`;
