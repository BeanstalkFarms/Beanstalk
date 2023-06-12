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
import SlippagePanel from "./SlippagePanel";

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
  inputs?: TokenValue[];
  slippage: number;
  wellLpToken?: ERC20Token | undefined;
  wellTokens?: Token[] | undefined;
  selectedTokenIndex?: number;
  slippageSettingsClickHandler: () => void;
  handleSlippageValueChange: (value: string) => void;
  tokenPrices?: (TokenValue | undefined | null)[];
  tokenReserves?: (TokenValue | undefined | null)[];
};

const QuoteDetails = ({
  type,
  removeLiquidityMode,
  quote,
  inputs,
  slippage,
  wellLpToken,
  wellTokens,
  selectedTokenIndex,
  slippageSettingsClickHandler,
  handleSlippageValueChange,
  tokenPrices,
  tokenReserves
}: QuoteDetailsProps) => {
  const sdk = useSdk();
  const [gasFeeUsd, setGasFeeUsd] = useState<string>("");
  const [tokenUSDValue, setTokenUSDValue] = useState<TokenValue>(TokenValue.ZERO);

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

    if (type === LIQUIDITY_OPERATION_TYPE.ADD) {
      const _quoteValue = quote?.quote as TokenValue;
      return `${_quoteValue.toHuman("0,0.0000")} ${wellLpToken!.symbol}`;
    }

    if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom) {
      const _quoteValue = inputs as TokenValue[];
      const allTokensValue: string[] = [];
      if (!wellTokens!.length || wellTokens!.length !== _quoteValue.length) {
        return null;
      }
      wellTokens?.forEach((token, index) => {
        allTokensValue.push(`${_quoteValue[index].toHuman("0,0.0000")} ${token.symbol}`);
      });
      return allTokensValue.join(", ");
    }

    if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken) {
      const _quoteValue = quote?.quote as TokenValue;
      return `${_quoteValue.toHuman("0,0.0000")} ${wellTokens![selectedTokenIndex || 0]!.symbol}`;
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

 useEffect(() => {
    const run = async() => {
      if (tokenPrices && tokenReserves && quote && quote.quote) {
        if (type === LIQUIDITY_OPERATION_TYPE.REMOVE) {

          let totalUSDValue = TokenValue.ZERO
          let valueInUSD
          if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken) {
            valueInUSD = tokenPrices![selectedTokenIndex!]!.mul(!Array.isArray(quote.quote) ? quote.quote || TokenValue.ZERO : TokenValue.ZERO)
            totalUSDValue = totalUSDValue.add(valueInUSD)
          } else {
            for (let i = 0; i < tokenPrices.length; i++) {
              valueInUSD = tokenPrices![i]!.mul(Array.isArray(quote.quote) ? quote.quote![i] || TokenValue.ZERO : TokenValue.ZERO)
              totalUSDValue = totalUSDValue.add(valueInUSD)
            }
          }
          setTokenUSDValue(totalUSDValue)

        } else if (type === LIQUIDITY_OPERATION_TYPE.ADD) {

          let totalReservesUSDValue = TokenValue.ZERO
          for (let i = 0; i < tokenPrices.length; i++) {
            const reserveValueInUSD = tokenPrices![i]!.mul(tokenReserves[i]!.add(inputs![i] || TokenValue.ZERO))
            totalReservesUSDValue = totalReservesUSDValue.add(reserveValueInUSD)
          }
          const lpTokenSupply = await wellLpToken?.getTotalSupply()
          if (!lpTokenSupply || lpTokenSupply.eq(TokenValue.ZERO)) {
            setTokenUSDValue(TokenValue.ZERO)
            return
          }
          const lpTokenUSDValue = totalReservesUSDValue.div(lpTokenSupply)
          const finalUSDValue = !Array.isArray(quote.quote) ? lpTokenUSDValue.mul(quote.quote) : TokenValue.ZERO
          setTokenUSDValue(finalUSDValue)

        }
      }
    }

    run();
  }, [tokenPrices, tokenReserves, quote, type, selectedTokenIndex])

  return (
    <QuoteContainer>
      <QuoteDetailLine>
        <QuoteDetailLabel bold color={"black"}>Expected Output</QuoteDetailLabel>
        <QuoteDetailValue bold color={"black"}>{quoteValue}</QuoteDetailValue>
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel>USD Value</QuoteDetailLabel>
        <QuoteDetailValue>{`$${tokenUSDValue.toHuman("0,0.00")}`}</QuoteDetailValue>
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel>Price Impact</QuoteDetailLabel>
        <QuoteDetailValue>{"1.00%"}</QuoteDetailValue>
        <Icon src={infoIcon} alt={"More Info"} />
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel id={"slippage"}>Slippage Tolerance</QuoteDetailLabel>
        <QuoteDetailValue>{`${slippage}%`}</QuoteDetailValue>
        <SlippagePanel
          slippageValue={slippage}
          connectorFor={"slippage"}
          handleSlippageValueChange={handleSlippageValueChange}
        />
      </QuoteDetailLine>
      <QuoteDetailLine>
        <QuoteDetailLabel>Estimated Gas Fee</QuoteDetailLabel>
        <QuoteDetailValue>{`${gasFeeUsd}`}</QuoteDetailValue>
      </QuoteDetailLine>
    </QuoteContainer>
  );
};

export default QuoteDetails;

const Icon = styled.img`
  margin-left: 10px;
`;

type QuoteDetailProps = {
  bold?: boolean;
  color?: string;
};

const QuoteDetailLabel = styled.div<QuoteDetailProps>`
  align-items: flex-start;
  width: 50%;
  font-weight: ${(props) => (props.bold ? "bold" : "normal")};
  color: ${(props) => (props.color ? props.color : "#9CA3AF")};
`;

const QuoteDetailValue = styled.div<QuoteDetailProps>`
  align-items: flex-end;
  text-align: right;
  width: 50%;
  font-weight: ${(props) => (props.bold ? "bold" : "normal")};
  color: ${(props) => (props.color ? props.color : "#9CA3AF")};
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
