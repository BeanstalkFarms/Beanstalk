import React, { MouseEvent, useRef, useState } from "react";
import { Token, TokenValue } from "@beanstalk/sdk";
import { FC } from "src/types";
import styled from "styled-components";
import { BasicInput } from "./BasicInput";
import { TokenPicker } from "./TokenPicker";

type ContainerProps = {
  width: string;
  focused: boolean;
};

type TokenInput = {
  token: Token;
  amount?: TokenValue;
  width?: string;
  canChangeToken?: boolean;
  showBalance?: boolean;
  allowNegative?: boolean;
  onAmountChange?: (a: TokenValue) => void;
  onTokenChange?: (t: Token) => void;
};

export const TokenInput: FC<TokenInput> = ({
  token,
  amount,
  onAmountChange,
  onTokenChange,
  width,
  canChangeToken = false,
  showBalance = true,
  allowNegative = false
}) => {
  const [focused, setFocused] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  width = width ?? "100%";

  const handleAmountChange = (cleanValue: string) => {
    const newAmount = token.amount(cleanValue);
    onAmountChange && onAmountChange(newAmount);
  };

  const handleTokenChange = (token: Token) => {
    if (amount) {
      const newAmount = token.amount(amount.toHuman());
      onAmountChange && onAmountChange(newAmount);
    }
    onTokenChange && onTokenChange(token);
  };

  const handleFocus = () => setFocused(true);
  const handleBlur = () => setFocused(false);
  const handleClick = () => {
    inputRef.current && inputRef.current.focus();
  };

  const handleClickMax = () => {
    console.log("Max clicked");
  };

  /**
   * We have a fake focus outline around TokenInput that kind of
   * imitates the focus of a normal input. This focus is lost when
   * use clicks on other things inside TokenInput, but not on the input
   * so we use this method to stop other elements from stealing focus.
   *
   * We also need to add an exception for the input element itself, otherwise
   * events like double-clicking to select won't work
   */
  const dontStealFocus = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName !== "INPUT") {
      e.preventDefault();
    }
  };

  return (
    <Container width={width} focused={focused} id="token-input" onClick={handleClick} onMouseDown={dontStealFocus}>
      <TopRow>
        <BasicInput
          value={amount?.toHuman() || ""}
          onChange={handleAmountChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          inputRef={inputRef}
          allowNegative={allowNegative}
        />
        <TokenPicker token={token} editable={canChangeToken} onChange={handleTokenChange} />
      </TopRow>
      {showBalance && (
        <BalanceRow>
          <Balance>Balance: 3503.2351</Balance>
          <MaxButton onClick={handleClickMax}>Max</MaxButton>
        </BalanceRow>
      )}
    </Container>
  );
};

const Container = styled.div<ContainerProps>`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  height: 96px;

  padding: 0px 16px;
  background: #272a37;

  border: 2px solid rgb(${(props) => (props.focused ? "157 202 230" : "0 0 0 / 0%")});
  box-sizing: border-box;
  border-radius: 12px;

  overflow: hidden;
  justify-content: center;
  gap: 8px;
  cursor: text;
`;

const TopRow = styled.div`
  display: flex;
`;
const BalanceRow = styled.div`
  // border: 1px solid red;
  display: flex;
  justify-content: flex-end;
`;

const Balance = styled.div`
  display: flex;
  font-family: "Inter";
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 17px;
  color: #b0b1b5;
`;

const MaxButton = styled.button`
  background: none;
  border: none;
  font-family: "Inter";
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 17px;
  text-align: center;
  color: #f6e27f;
  cursor: pointer;
`;
