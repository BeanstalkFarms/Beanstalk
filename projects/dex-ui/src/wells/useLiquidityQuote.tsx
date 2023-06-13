import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { Token, TokenValue } from "@beanstalk/sdk";
import { useMemo } from "react";
import { REMOVE_LIQUIDITY_MODE } from "src/components/Liquidity/types";
import { Log } from "src/utils/logger";
import { useAccount } from "wagmi";

export const useLiquidityQuote = (
  well: Well,
  removeLiquidityMode: REMOVE_LIQUIDITY_MODE,
  lpTokenAmount: TokenValue,
  singleTokenIndex: number,
  wellTokens: Token[],
  amounts: TokenValue[],
) => {
  const { address } = useAccount();

  const oneAmountNonZero = useMemo(
    () => {
      if (!well.tokens) {
        return false;
      }

      if (well.tokens.length === 0) {
        return false;
      }

      const nonZeroValues = amounts.filter((amount) => amount && amount.value.gt("0")).length;
      
      return nonZeroValues !== 0;
    },
    [amounts, well.tokens]
  );

  Log.module("useliquidityquote").debug("Quote details:", { amounts, oneAmountNonZero, removeLiquidityMode });

  const {
    data: balancedQuote,
    isLoading: loadingBalancedQuote,
    isError: balanedQuoteError
  } = useQuery(["wells", "quote", "removeLiquidity", well.address, removeLiquidityMode, lpTokenAmount], async () => {
    if (!lpTokenAmount || removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Balanced) {
      return null;
    }

    if (!lpTokenAmount || lpTokenAmount.eq(TokenValue.ZERO) || !address) {
      return null;
    }

    try {
      const quote = await well.removeLiquidityQuote(lpTokenAmount);
      const estimate = await well.removeLiquidityEstimateGas(lpTokenAmount, quote, address);
      return {
        quote,
        estimate
      };
    } catch (error: any) {
      Log.module("addliquidity").error("Error during quote: ", (error as Error).message);
      return null;
    }
  });

  const {
    data: oneTokenQuote,
    isLoading: loadingOneTokenQuote,
    isError: oneTokenQuoteError
  } = useQuery(["wells", "quote", "removeliquidity", well.address, removeLiquidityMode, lpTokenAmount, singleTokenIndex], async () => {
    if (removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken) {
      return null;
    }

    if (!lpTokenAmount || lpTokenAmount.eq(TokenValue.ZERO) || !address) {
      return null;
    }

    try {
      const quote = await well.removeLiquidityOneTokenQuote(lpTokenAmount, wellTokens![singleTokenIndex]);
      const estimate = await well.removeLiquidityOneTokenGasEstimate(lpTokenAmount, wellTokens![singleTokenIndex], quote, address);
      return {
        quote,
        estimate
      };
    } catch (error: any) {
      Log.module("useliquidityquote").error("Error during quote: ", (error as Error).message);
      return null;
    }
  });

  const {
    data: customRatioQuote,
    isLoading: loadingCustomRatioQuote,
    isError: customRatioQuoteError
  } = useQuery(["wells", "quote", "removeliquidity", well.address, removeLiquidityMode, amounts], async () => {
    if (removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom) {
      return null;
    }

    if (!amounts || !oneAmountNonZero || !address) {
      return null;
    }

    try {
      console.log("AMOUNTS:", amounts)
      const quote = await well.removeLiquidityImbalancedQuote(amounts);
      const estimate = await well.removeLiquidityImbalancedEstimateGas(quote, amounts, address);
      return {
        quote,
        estimate
      };
    } catch (error: any) {
      Log.module("addliquidity").error("Error during quote: ", (error as Error).message);
      return null;
    }
  });

  return {
    balanced: {
      balancedQuote,
      loadingBalancedQuote,
      balanedQuoteError
    },
    oneToken: {
      oneTokenQuote,
      loadingOneTokenQuote,
      oneTokenQuoteError
    },
    custom: {
      customRatioQuote,
      loadingCustomRatioQuote,
      customRatioQuoteError
    }
  };
};
