import { Token, TokenValue } from "@beanstalk/sdk";
import React, { FocusEventHandler, RefObject, useState } from "react";
import { FC } from "src/types";
import styled from "styled-components";

type Props = {
  id?: string;
  value?: string;
  label: string;
  inputRef: RefObject<HTMLInputElement>;
  allowNegative?: boolean;
  onChange?: (v: string) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
};

export const BasicInput: FC<Props> = ({ id: _id, label, value, allowNegative = false, onChange, onFocus, onBlur, inputRef }) => {
  const [id, _] = useState(_id ?? Math.random().toString(36).substring(2, 7));
  const [displayValue, setDisplayValue] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;
    let cleanValue = rawValue;
    if (rawValue === "") cleanValue = "0";
    if (rawValue === ".") {
      cleanValue = "0";
    }
    if (rawValue.startsWith(".") && rawValue.length > 1) {
      rawValue = `0${rawValue}`;
    }
    setDisplayValue(rawValue);
    onChange?.(cleanValue);
  };

  const filterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // allow "-" only when allowNegative is true, and only allow it once
    //input type "number" lets you enter two "-"
    if (e.key === "-" && (!allowNegative || (e.target as HTMLInputElement).value.length > 1)) {
      e.preventDefault();
    }

    e.target;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const regN = "^-?([0-9]*[.])?[0-9]+$";
    const regP = "^([0-9]*[.])?[0-9]+$";
    const reg = allowNegative ? regN : regP;
    const current = e.currentTarget.value;

    if (!current) {
      e.currentTarget.value = "";
    }
    if (!(current + e.clipboardData.getData("Text")).match(reg) && e.clipboardData.getData("Text").match(reg)) {
      e.currentTarget.value = "";
    }
    if (!e.clipboardData.getData("Text").match(reg)) {
      e.preventDefault();
    }
  };

  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <StyledInput
        id={id}
        type="number"
        inputMode="decimal"
        value={displayValue}
        placeholder="0"
        onInput={handleChange}
        onKeyDown={filterKeyDown}
        onPaste={handlePaste}
        onFocus={onFocus}
        onBlur={onBlur}
        ref={inputRef}
        spellCheck="false"
        autoCorrect="off"
        autoComplete="off"
      />
    </>
  );
};

const StyledInput = styled.input`
  // border: 1px solid red;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 0px;
  box-sizing: border-box;
  width: 100%;
  background: #272a37;
  font-family: "Inter";
  font-style: normal;
  font-weight: 500;
  font-size: 30px;
  line-height: 36px;
  text-align: left;

  color: #b0b1b5;
  outline: none;
`;

/**
 * this is standard css for 'screen-reader-text'
 * meant to hide the label attribute from display, but
 * still make it visible to screen readers
 */
const Label = styled.label`
  border: 0;
  clip: rect(1px, 1px, 1px, 1px);
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  width: 1px;
  overflow: hidden;
  position: absolute !important;
  word-wrap: normal !important;
`;
