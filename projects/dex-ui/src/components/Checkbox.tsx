import { FC } from "src/types";
import React from "react";
import styled from "styled-components";

type Props = {
  label?: string;
  checked?: boolean;
  mode?: string;
  checkboxColor?: string;
  onClick?: () => void;
};

export const Checkbox: FC<Props> = ({ label, checked = false, mode, checkboxColor, onClick = () => {} }) => {
  return (
    <StyledCheckbox>
      <HiddenCheckbox type="checkbox" role={"checkbox"} checked={checked} readOnly />
      <HoverContainer>
        <StyledCheckboxContainer checked={checked} onClick={onClick} mode={mode} checkboxColor={checkboxColor}>
          <HoverCheckmark checked={checked} checkboxColor={checkboxColor} />
          <Checkmark checked={checked} checkboxColor={checkboxColor} />
        </StyledCheckboxContainer>
        {label && (
          <CheckboxText checked={checked} onClick={onClick}>
            {label}
          </CheckboxText>
        )}
      </HoverContainer>
    </StyledCheckbox>
  );
};

type CheckboxProps = {
  checked?: boolean;
  checkboxColor?: string;
  mode?: string;
};

const StyledCheckbox = styled.div`
  position: relative;
`;

const HoverContainer = styled.div``;

const HiddenCheckbox = styled.input.attrs({ type: "checkbox" })`
  border: 0;
  clip: rect(0 0 0 0);
  clippath: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const StyledCheckboxContainer = styled.div<CheckboxProps>`
  border: 1px solid ${(props) => (props.checkboxColor && props.checked ? props.checkboxColor : "#000")};
  border-radius: 1em;
  width: 16px;
  height: 16px;
  position: ${(props) => (props.mode === "checkOnly" ? "relative" : "absolute")};
  top: ${(props) => (props.mode === "checkOnly" ? "0px" : "2px")};
  cursor: pointer;
`;

const Checkmark = styled.div<CheckboxProps>`
  border: 1px solid ${(props) => (props.checkboxColor ? props.checkboxColor : "#FFF")};
  border-radius: 1em;
  width: 8px;
  height: 8px;
  position: ${(props) => (props.mode === "checkOnly" ? "relative" : "absolute")};
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${(props) => (props.checkboxColor ? props.checkboxColor : "#FFF")};
  filter: ${(props) => (props.checkboxColor ? "brightness(100%);" : "brightness(0%);")}
  opacity: ${(props) => (props.checked ? "1" : "0")};
  z-index: 2;
`;

const HoverCheckmark = styled.div<CheckboxProps>`
  border: 1px solid transparent;
  border-radius: 1em;
  width: 8px;
  height: 8px;
  position: ${(props) => (props.mode === "checkOnly" ? "relative" : "absolute")};
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: transparent;
  ${HoverContainer}:hover & {
    border: 1px solid ${(props) => (props.checkboxColor ? props.checkboxColor : "#FFF")};
    background: ${(props) => (props.checkboxColor ? props.checkboxColor : "#FFF")};
    filter: brightness(50%);
  }
  z-index: 1;
`;

const CheckboxText = styled.div<CheckboxProps>`
  margin-left: 1.5em;
  font-weight: ${(props) => (props.checked ? "600" : "normal")};
  cursor: pointer;
  :hover {
    font-weight: 600;
  }
  ${HoverContainer}:hover & {
    font-weight: 600;
  }
  user-select: none;
`;
