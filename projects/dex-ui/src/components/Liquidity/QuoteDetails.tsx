import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk";
import useSdk from "src/utils/sdk/useSdk";
import { LIQUIDITY_OPERATION_TYPE, REMOVE_LIQUIDITY_MODE } from "./types";
import { getGasInUsd } from "src/utils/gasprice";
import SlippagePanel from "./SlippagePanel";
import { ChevronDown, Info } from "../Icons";
import { ImageButton } from "../ImageButton";

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
  lpTokenAmount?: TokenValue;
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
  handleSlippageValueChange,
  tokenPrices,
  tokenReserves
}: QuoteDetailsProps) => {
  const sdk = useSdk();
  const [gasFeeUsd, setGasFeeUsd] = useState<string>("");
  const [tokenUSDValue, setTokenUSDValue] = useState<TokenValue>(TokenValue.ZERO);
  const [accordionOpen, setAccordionOpen] = useState<boolean>(false)

  useEffect(() => {
    const _setGasFeeUsd = async () => {
      if (!quote || !quote.estimate) {
        setGasFeeUsd("0.00");
      } else {
        const usd = await getGasInUsd(sdk, quote!.estimate.toBigNumber());
        setGasFeeUsd(`~${usd.toLocaleString("en-US", {
            style: "currency",
            currency: "USD"
          })}`
        );
      }
    };

    _setGasFeeUsd();
  }, [sdk.provider, sdk, quote]);

  const quoteValue = useMemo(() => {
    if (!quote || !quote.quote) {
      return 'X.XXXX TOKEN';
    }

    if (type === LIQUIDITY_OPERATION_TYPE.REMOVE) {
      if (!wellTokens) {
        return 'X.XXXX TOKEN';
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
  }, [quote, type, wellLpToken, wellTokens, removeLiquidityMode, inputs, selectedTokenIndex]);

 useEffect(() => {
    const run = async() => {
      if (tokenPrices && tokenReserves && quote && quote.quote) {
        if (type === LIQUIDITY_OPERATION_TYPE.REMOVE) {
          let totalUSDValue = TokenValue.ZERO;
          let valueInUSD
          if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken) {
            valueInUSD = tokenPrices![selectedTokenIndex!]!.mul(!Array.isArray(quote.quote) ? quote.quote || TokenValue.ZERO : TokenValue.ZERO);
            totalUSDValue = totalUSDValue.add(valueInUSD);
          } else {
            for (let i = 0; i < tokenPrices.length; i++) {
              valueInUSD = tokenPrices![i]!.mul(removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced && Array.isArray(quote.quote) ? quote.quote[i] || TokenValue.ZERO : inputs![i] || TokenValue.ZERO);
              totalUSDValue = totalUSDValue.add(valueInUSD);
            }
          }
          setTokenUSDValue(totalUSDValue);

        } else if (type === LIQUIDITY_OPERATION_TYPE.ADD) {

          let totalReservesUSDValue = TokenValue.ZERO;
          for (let i = 0; i < tokenPrices.length; i++) {
            const reserveValueInUSD = tokenPrices![i]!.mul(tokenReserves[i]!.add(inputs![i] || TokenValue.ZERO));
            totalReservesUSDValue = totalReservesUSDValue.add(reserveValueInUSD);
          }
          const lpTokenSupply = await wellLpToken?.getTotalSupply();
          if (!lpTokenSupply || lpTokenSupply.eq(TokenValue.ZERO)) {
            setTokenUSDValue(totalReservesUSDValue);
            return;
          }
          const lpTokenUSDValue = totalReservesUSDValue.div(lpTokenSupply);
          const finalUSDValue = !Array.isArray(quote.quote) ? lpTokenUSDValue.mul(quote.quote) : TokenValue.ZERO;
          setTokenUSDValue(finalUSDValue);
        }
      }
    }

    run();
  }, [tokenPrices, tokenReserves, quote, type, selectedTokenIndex, inputs, removeLiquidityMode, wellLpToken]);

  const priceImpact = useMemo(() => {

    if (!tokenReserves || !inputs || !tokenPrices) return TokenValue.ZERO

    function calculatePrice(prevVal: any, token: any) {
      if (token.eq(TokenValue.ZERO)) {
        return TokenValue.ZERO
      };
      return prevVal!.div(token!);
    };

    const currentData = tokenReserves.map((token, index) =>
      tokenReserves[index]?.mul(tokenPrices![index]!)
        //'reservesUSD': tokenReserves[index]!.mul(tokenPrices![index]!)
    );

    const newData = tokenReserves.map((token, index) => {
      if (!quote) return TokenValue.ZERO;
      if (type === LIQUIDITY_OPERATION_TYPE.REMOVE) {
        if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Custom) {
          return (tokenReserves[index]?.sub(inputs![index] || TokenValue.ZERO).mul(tokenPrices![index]!));
        } else if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.OneToken && !Array.isArray(quote!.quote)) {
          return (tokenReserves[index]?.sub(index === selectedTokenIndex ? quote!.quote : TokenValue.ZERO).mul(tokenPrices![index]!));
        } else if (removeLiquidityMode === REMOVE_LIQUIDITY_MODE.Balanced && Array.isArray(quote!.quote)) {
          return (tokenReserves[index]?.sub(quote!.quote[index]).mul(tokenPrices![index]!));
        } else {
          return TokenValue.ZERO
        };
      } else {
        return (tokenReserves[index]?.add(inputs![index] || TokenValue.ZERO).mul(tokenPrices![index]!));
      };
    });

    const oldPrice = currentData.reduce(calculatePrice)
    const newPrice = newData.reduce(calculatePrice)

    let priceDiff
    if (!newPrice || !oldPrice) {
      return TokenValue.ZERO;
    } else if (newPrice?.eq(TokenValue.ZERO)) {
      return TokenValue.fromHuman(-100, 6);
    } else if (oldPrice?.eq(TokenValue.ZERO)) {
      return TokenValue.fromHuman(100, 6);
    } else {
      priceDiff = oldPrice.sub(newPrice).div(newPrice).mul(TokenValue.fromHuman(100, 6))
    }

    if (priceDiff.abs().lt(TokenValue.fromHuman('0.01', 6))) return TokenValue.ZERO
    return priceDiff

  }, [tokenReserves, inputs, quote, removeLiquidityMode, selectedTokenIndex, tokenPrices, type])

  return (
    <QuoteContainer>
      <QuoteDetailLine onClick={() => setAccordionOpen(!accordionOpen)} cursor="pointer">
        <QuoteDetailLabel bold color={"black"} cursor={"pointer"}>Expected Output</QuoteDetailLabel>
        <QuoteDetailValue bold color={"black"} cursor={"pointer"}>{quoteValue}</QuoteDetailValue>
        <ImageButton component={ChevronDown} size={8} rotate={accordionOpen ? "180" : "0"} onClick={() => setAccordionOpen(!accordionOpen)} padding="0px" margin="-2px 0px 0px 8px" alt="Click to view more information about this transaction" />
      </QuoteDetailLine>
      <AccordionContainer open={accordionOpen}>
        <QuoteDetailLine>
          <QuoteDetailLabel>USD Value</QuoteDetailLabel>
          <QuoteDetailValue>{`$${tokenUSDValue.toHuman("0,0.00")}`}</QuoteDetailValue>
        </QuoteDetailLine>
        <QuoteDetailLine>
          <QuoteDetailLabel>Price Impact</QuoteDetailLabel>
          <QuoteDetailValue>{`${priceImpact.toHuman("0,0.00")}%`}</QuoteDetailValue>
          <IconContainer>
            <Info color={"#9CA3AF"} />
          </IconContainer>
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
      </AccordionContainer>
    </QuoteContainer>
  );
};

export default QuoteDetails;

type QuoteDetailProps = {
  bold?: boolean;
  color?: string;
  cursor?: string;
};

type AccordionProps = {
  open?: boolean;
}

const AccordionContainer = styled.div<AccordionProps>`
  height: ${(props) => (props.open ? '94px' : '0px')};
  overflow: hidden;
  transition: height 0.2s
`

const IconContainer = styled.div`
  margin-left: 10px;
  margin-top: 2px;
  margin-bottom: -2px;
`

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

const QuoteDetailLine = styled.div<QuoteDetailProps>`
  display: flex;
  flex-direction: row;
  width: 100%;
  cursor: ${(props) => (props.cursor ?? "auto")};
`;

const QuoteContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
