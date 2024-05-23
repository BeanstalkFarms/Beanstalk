import React from "react";
import { theme } from "src/utils/ui/theme";
import styled from "styled-components";

// Styled components

// TODO: add props for size. Currently, we only support 20 x 32px (w,h) dimensions

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

  transition: left 0.2s; background-color 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

// Component
export const ToggleSwitch = ({ checked, toggle }: { checked: boolean; toggle: () => void }) => {
  return (
    <ToggleContainer checked={checked} onClick={toggle}>
      <ToggleCircle checked={checked} />
    </ToggleContainer>
  );
};
