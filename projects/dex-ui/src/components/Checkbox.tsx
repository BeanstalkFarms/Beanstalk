import { FC } from "src/types";
import React from "react";
import styled from "styled-components";

type Props = {
  label?: string;
  checked?: boolean;
  onClick?: () => void;
};

export const Checkbox: FC<Props> = ({ label = "This is a checkbox", checked = false, onClick = () => {} }) => {
  return (
    <StyledCheckbox>
      <HiddenCheckbox type="checkbox" role={"checkbox"} checked={checked} />
      <HoverContainer>
        <StyledCheckboxContainer checked={checked} onClick={onClick}>
          <HoverCheckmark checked={checked} />
          <Checkmark checked={checked} />
        </StyledCheckboxContainer>
        <CheckboxText checked={checked} onClick={onClick}>
          {label}
        </CheckboxText>
      </HoverContainer>
    </StyledCheckbox>
  );
};

type CheckboxProps = {
  checked?: boolean;
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
  border: 1px solid;
  border-radius: 1em;
  width: 16px;
  height: 16px;
  position: absolute;
  top: 2px;
  cursor: pointer;
`;

const Checkmark = styled.div<CheckboxProps>`
  border: 1px solid;
  border-radius: 1em;
  width: 8px;
  height: 8px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #000;
  opacity: ${(props) => (props.checked ? "1" : "0")};
  z-index: 2;
`;

const HoverCheckmark = styled.div<CheckboxProps>`
  border: 1px solid transparent;
  border-radius: 1em;
  width: 8px;
  height: 8px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: transparent;
  ${HoverContainer}:hover & {
    border: 1px solid #9ca3af;
    background: #9ca3af;
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
