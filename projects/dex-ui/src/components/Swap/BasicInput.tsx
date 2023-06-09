import React, { FocusEventHandler, RefObject, useCallback, useEffect, useState } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import numeral from "numeral";
import { TokenValue } from "@beanstalk/sdk";

type Props = {
  id?: string;
  value?: string;
  label: string;
  inputRef: RefObject<HTMLInputElement>;
  allowNegative?: boolean;
  onChange?: (v: string) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  canChangeValue?: boolean;
};

export const BasicInput: FC<Props> = ({
  id: _id,
  label,
  value,
  allowNegative = false,
  onChange,
  onFocus,
  onBlur,
  inputRef,
  canChangeValue = true
}) => {
  const [id, _] = useState(_id ?? Math.random().toString(36).substring(2, 7));
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // We need to use TokenValue comparison here because there are edge cases where
    // a user my type "1.04", then delete the "4". Now you have a value of "1" and a displayValue of "1.0"
    // which are mathematically equal, so we shouldn't update the displayValue.
    // But we need to do this comparison in big number space, using TokenValue.

    if (TokenValue.fromHuman(value || 0, 18).eq(TokenValue.fromHuman(displayValue || 0, 18))) return;
    // setDisplayValue(value === "0" || value === "" ? "" : numeral(value).format("0.00000"));
    setDisplayValue(value === "0" || value === "" ? "" : value);

    // adding displayValue to the dependency array breaks the input in some edge cases
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value;
      let cleanValue = rawValue;
      if (rawValue === "") cleanValue = "0";
      if (rawValue === ".") {
        cleanValue = "0";
      }
      if (rawValue == "00") cleanValue = "0";
      if (rawValue.startsWith(".") && rawValue.length > 1) {
        rawValue = `0${rawValue}`;
      }
      // strip out multiple zeros at the beginning
      // ex: "0004" => "04"
      let cleanRaw = rawValue.replace(/^0+/, "0");
      // remove the leading zero if not followed by a "."
      cleanRaw = rawValue.replace(/(^0)(?=[^\.])/, "");

      setDisplayValue(cleanRaw);
      onChange?.(cleanValue);
    },
    [onChange]
  );

  const filterKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // allow "-" only when allowNegative is true, and only allow it once
      //input type "number" lets you enter two "-"
      if (e.key === "-" && (!allowNegative || (e.target as HTMLInputElement).value.length > 1)) {
        e.preventDefault();
      }

      e.target;
    },
    [allowNegative]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
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
    },
    [allowNegative]
  );

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
        readOnly={!canChangeValue}
      />
    </>
  );
};

const StyledInput = styled.input`
  // border: 1px solid red;
  border: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 0px;
  box-sizing: border-box;
  width: 100%;
  background: #ffffff;
  font-style: normal;
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  text-align: left;

  color: #;
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
