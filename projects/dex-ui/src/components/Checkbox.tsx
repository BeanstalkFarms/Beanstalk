import { FC } from "src/types";
import React from "react";
import styled from "styled-components";
import { BodyXS } from "./Typography";
import { size } from "src/breakpoints";

type Props = {
  label?: string;
  checked?: boolean;
  mode?: string;
  checkboxColor?: string;
  onClick?: () => void;
};

export const Checkbox: FC<Props> = ({ label, checked = false, mode, checkboxColor = "black", onClick = () => {} }) => {
  return (
    <StyledCheckbox>
      <HiddenCheckbox type="checkbox" role={"checkbox"} checked={checked} readOnly />
      <HoverContainer>
        <StyledCheckboxContainer checked={checked} onClick={onClick} mode={mode} checkboxColor={checkboxColor}>
          {checked && (
            <CheckMark xmlns="http://www.w3.org/2000/svg" width={13} viewBox="0 0 179 129">
              <path
                fill="none"
                fillRule="evenodd"
                stroke={checkboxColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={31}
                d="m15.515 61.76 51.253 51.253 96.623-96.623"
              />
            </CheckMark>
          )}
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
  width: 16px;
  height: 16px;
  position: ${(props) => (props.mode === "checkOnly" ? "relative" : "absolute")};
  top: ${(props) => (props.mode === "checkOnly" ? "0px" : "2px")};
  cursor: pointer;
  @media (max-width: ${size.mobile}) {
    width: 14px;
    height: 14px;
  }
`;

const CheckMark = styled.svg`
  display: flex;
  margin-top: 3px;
  margin-left: 2px;
`;

const CheckboxText = styled.div<CheckboxProps>`
  margin-left: 1.5em;
  font-weight: ${(props) => (props.checked ? "600" : "normal")};
  cursor: pointer;
  user-select: none;
  @media (max-width: ${size.mobile}) {
    ${BodyXS}
  }
`;
