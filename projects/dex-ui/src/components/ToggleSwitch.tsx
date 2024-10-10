import React from "react";

import styled from "styled-components";

import { theme } from "src/utils/ui/theme";

// Styled components

// TODO: add props for size. Currently, we only support 20px x 32px

const ToggleContainer = styled.div<{ checked?: boolean; disabled?: boolean }>`
  position: relative;
  width: 32px;
  height: 20px;
  border-radius: 20px;
  border: 0.5px solid ${theme.colors.lightGray};
  background-color: ${theme.colors.white};
  box-sizing: border-box;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
`;

const ToggleCircle = styled.div<{ checked?: boolean; disabled?: boolean }>`
  position: absolute;
  top: 2px;
  left: ${(props) => (props.checked ? "14px" : "2px")};
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: ${(props) => (props.checked ? theme.colors.black : theme.colors.lightGray)};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  transition: left 200ms background-color 200ms;
`;

export type ToggleSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  toggle: () => void;
};
export const ToggleSwitch = ({ disabled, checked, toggle }: ToggleSwitchProps) => {
  return (
    <ToggleContainer checked={checked} onClick={disabled ? () => {} : toggle} disabled={disabled}>
      <ToggleCircle checked={checked} disabled={disabled} />
    </ToggleContainer>
  );
};
