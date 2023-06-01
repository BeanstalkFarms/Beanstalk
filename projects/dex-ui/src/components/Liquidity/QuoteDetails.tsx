import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk";
import { formatEther } from "ethers/lib/utils";

import gearIcon from "/src/assets/images/gear.svg";
import infoIcon from "/src/assets/images/info.svg";
import useSdk from "src/utils/sdk/useSdk";
import { LIQUIDITY_OPERATION_TYPE, REMOVE_LIQUIDITY_MODE } from "./types";
import { getPrice } from "src/utils/price/usePrice";
import { getGasInUsd } from "src/utils/gasprice";

type QuoteDetailsProps = {
  type: LIQUIDITY_OPERATION_TYPE;
  removeLiquidityMode?: REMOVE_LIQUIDITY_MODE | undefined;
  quote:
    | {
        quote: TokenValue | TokenValue[];
        estimate: TokenValue;
      }
    | null
    | undefined;
  slippage: number;
  wellLpToken?: ERC20Token | undefined;
  wellTokens?: Token[] | undefined;
  slippageSettingsClickHandler: () => void;
};

const QuoteDetails = ({
  type,
  removeLiquidityMode,
  quote,
  slippage,
  wellLpToken,
  wellTokens,
  slippageSettingsClickHandler
}: QuoteDetailsProps) => {
  const sdk = useSdk();
  const [gasFeeUsd, setGasFeeUsd] = useState<string>("");

  useEffect(() => {
    const _setGasFeeUsd = async () => {
      if (!quote || !quote.estimate) {
        setGasFeeUsd("0.00");
      }

      const usd = await getGasInUsd(sdk, quote!.estimate.toBigNumber());

      setGasFeeUsd(`~${usd.toLocaleString("en-US", {
          style: "currency",
          currency: "USD"
        })}`
      );
    };

    _setGasFeeUsd();
  }, [sdk.provider, sdk, quote]);

  const quoteValue = useMemo(() => {
    if (!quote) {
      return null;
    }

    if (!quote.quote) {
      return null;
    }

    if (type === LIQUIDITY_OPERATION_TYPE.REMOVE) {
      if (!wellTokens) {
        return null;
      }
    }

    if (
      type === LIQUIDITY_OPERATION_TYPE.ADD ||
      removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken ||
      removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom
    ) {
      const _quoteValue = quote?.quote as TokenValue;
      return `${_quoteValue.toHuman("0,0.0000")} ${wellLpToken!.symbol}`;
    }

    if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced) {
      const _quoteValue = quote?.quote as TokenValue[];
      const allTokensValue: string[] = [];
      if (!wellTokens!.length || wellTokens!.length !== _quoteValue.length) {
        return null;
      }
      wellTokens?.forEach((token, index) => {
        allTokensValue.push(`${_quoteValue[index].toHuman("0,0.0000")} ${token.symbol}`);
      });
      return allTokensValue.join(", ");
    }
    throw new Error("invalid type or removeLiquidityMode");
  }, [quote, type, wellLpToken, wellTokens, removeLiquidityMode]);

  return (
    <QuoteContainer>
      <QuoteDetailLine>
        <QuoteDetailLabel bold title>Expected Output</QuoteDetailLabel>
        <QuoteDetailValue bold title>{quoteValue}</QuoteDetailValue>
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel>Price Impact</QuoteDetailLabel>
        <QuoteDetailValue>{"1.00%"}</QuoteDetailValue>
        <GearImage src={infoIcon} alt={"More Info"} />
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel>Slippage Tolerance</QuoteDetailLabel>
        <QuoteDetailValue>{`${slippage}%`}</QuoteDetailValue>
        <GearImage src={gearIcon} alt={"Slippage Settings"} onClick={slippageSettingsClickHandler} />
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel>Estimated Gas Fee</QuoteDetailLabel>
        <QuoteDetailValue>{`${gasFeeUsd}`}</QuoteDetailValue>
      </QuoteDetailLine>
    </QuoteContainer>
  );
};

export default QuoteDetails;

const GearImage = styled.img`
  margin-left: 10px;
`;

type QuoteDetailProps = {
  bold?: boolean;
  title?: boolean;
};

const QuoteDetailLabel = styled.div<QuoteDetailProps>`
  align-items: flex-start;
  width: 50%;
  font-weight: ${(props) => (props.bold ? "bold" : "normal")};
  ${(props) => (props.title ? "" : "color: #9CA3AF;")}
`;

const QuoteDetailValue = styled.div<QuoteDetailProps>`
  align-items: flex-end;
  text-align: right;
  width: 50%;
  font-weight: ${(props) => (props.bold ? "bold" : "normal")};
  ${(props) => (props.title ? "" : "color: #9CA3AF;")}
`;

const QuoteDetailLine = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
`;

const QuoteContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
