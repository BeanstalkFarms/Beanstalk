import React, { useCallback, useRef } from "react";
import { Token, TokenValue } from "@beanstalk/sdk";
import debounce from "lodash/debounce";
import { FC } from "src/types";
import styled, { keyframes } from "styled-components";
import { BasicInput } from "./BasicInput";
import { TokenPicker } from "./TokenPicker";
import { useTokenBalance } from "src/tokens/useTokenBalance";
import { Spinner } from "../Spinner";
import { BodyXS } from "../Typography";
import { size } from "src/breakpoints";

type ContainerProps = {
  width: string;
  showBalance?: boolean;
};

type TokenInput = {
  id?: string;
  label: string;
  token: Token;
  amount?: TokenValue;
  width?: string;
  canChangeToken?: boolean;
  showBalance?: boolean;
  allowNegative?: boolean;
  loading: boolean;
  onAmountChange?: (a: TokenValue) => void;
  onTokenChange?: (t: Token) => void;
  canChangeValue?: boolean;
  debounceTime?: number;
};

export const TokenInput: FC<TokenInput> = ({
  id,
  label,
  token,
  amount,
  onAmountChange,
  onTokenChange,
  width,
  canChangeToken = false,
  showBalance = true,
  loading = false,
  allowNegative = false,
  canChangeValue = true,
  debounceTime = 500
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: balance, isLoading: isBalanceLoading } = useTokenBalance(token);
  width = width ?? "100%";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateAmount = useCallback(
    debounce((value: string) => {
      if (!token) return;
      const newAmount = token.amount(value);
      onAmountChange && onAmountChange(newAmount);
    }, debounceTime),
    [token, onAmountChange]
  );

  const handleAmountChange = useCallback(
    (cleanValue: string) => {
      updateAmount(cleanValue);
    },
    [updateAmount]
  );

  const handleTokenChange = useCallback(
    (token: Token) => {
      onTokenChange && onTokenChange(token);
    },
    [onTokenChange]
  );

  const handleClick = useCallback(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  const handleClickMax = useCallback(() => {
    const val = balance?.[token.symbol].toHuman() ?? "";
    handleAmountChange(val);
  }, [balance, handleAmountChange, token.symbol]);

  if (loading) return <LoadingContainer width={width} data-trace="true" />;

  return (
    <Container width={width} id="token-input" onClick={handleClick} showBalance={showBalance} data-trace="true">
      <TopRow>
        <BasicInput
          id={id}
          label={label}
          value={amount?.toHuman() || ""}
          onChange={handleAmountChange}
          inputRef={inputRef}
          allowNegative={allowNegative}
          canChangeValue={!!canChangeValue}
        />
        <TokenPicker token={token} editable={canChangeToken} onChange={handleTokenChange} connectorFor={id} />
      </TopRow>

      {showBalance && (
        <BalanceRow>
          <Balance onClick={handleClickMax}>
            Balance: {isBalanceLoading ? <Spinner size={12} /> : balance?.[token.symbol].toHuman("short")}
          </Balance>
        </BalanceRow>
      )}
    </Container>
  );
};

const shimmer = keyframes`
  0% {
      background-position: -1600px 0;
  }
  100% {
      background-position: 1200px 0;
  }
`;

const LoadingContainer = styled.div<ContainerProps>`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  height: 72px;

  padding: 0px 16px;
  background: #272a37;

  outline: 0.5px solid black;
  outline-offset: -1px;
  box-sizing: border-box;

  overflow: hidden;
  justify-content: center;
  cursor: text;

  animation-duration: 2s;
  animation-fill-mode: forwards;
  animation-iteration-count: infinite;
  animation-name: ${shimmer};
  animation-timing-function: linear;
  background: #ddd;
  background: linear-gradient(65deg, #f9f8f6 10%, #fff 20%, #f9f8f6 30%);
  background-size: 1200px 100%;
`;
const Container = styled.div<ContainerProps>`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  height: 72px;

  padding: 0px 16px;
  background: #ffffff;

  outline: 0.5px solid #000;
  box-sizing: border-box;

  overflow: hidden;
  justify-content: center;

  cursor: text;
  :focus-within {
    outline: 0.5px solid #46b955;
  }
  :hover {
    outline: 2px solid #46b955;
  }
  @media (max-width: ${size.mobile}) {
    height: ${(props) => (props.showBalance ? `72px` : `48px`)};
    padding: 12px;
  }
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
  align-items: center;
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: #9ca3af;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  cursor: pointer;
  @media (max-width: ${size.mobile}) {
    ${BodyXS}
  }
`;
