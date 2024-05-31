import React from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";

// Styled components

// TODO: add props for size. Currently, we only support 20px x 32px

const ToggleContainer = styled.div<{ checked?: boolean }>`
  position: relative;
  width: 32px;
  height: 20px;
  border-radius: 20px;
  border: 0.5px solid ${theme.colors.lightGray};
  background-color: ${theme.colors.white};
  box-sizing: border-box;
  cursor: pointer;
`;

const ToggleCircle = styled.div<{ checked?: boolean }>`
  position: absolute;
  top: 2px;
  left: ${(props) => (props.checked ? "14px" : "2px")};
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: ${(props) => (props.checked ? theme.colors.black : theme.colors.lightGray)};
  transition: left 200ms; background-color 200ms;
`;

// Component
export const ToggleSwitch = ({ checked, toggle }: { checked: boolean; toggle: () => void }) => {
  return (
    <ToggleContainer checked={checked} onClick={toggle}>
      <ToggleCircle checked={checked} />
    </ToggleContainer>
  );
};
