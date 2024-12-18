import { useMemo } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import { useAccount } from "wagmi";

import { Token, TokenValue } from "@beanstalk/sdk";

import { REMOVE_LIQUIDITY_MODE } from "src/components/Liquidity/types";
import { Log } from "src/utils/logger";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";

export const useLiquidityQuote = (
  well: Well,
  removeLiquidityMode: REMOVE_LIQUIDITY_MODE,
  lpTokenAmount: TokenValue,
  singleTokenIndex: number,
  wellTokens: Token[],
  amounts: TokenValue[]
) => {
  const { address } = useAccount();
  const oneAmountNonZero = useMemo(() => {
    if (!well.tokens) {
      return false;
    }

    if (well.tokens.length === 0) {
      return false;
    }

    const nonZeroValues = amounts.filter((amount) => amount && amount.value.gt("0")).length;

    return nonZeroValues !== 0;
  }, [amounts, well.tokens]);

  Log.module("useliquidityquote").debug("Quote details:", {
    amounts,
    oneAmountNonZero,
    removeLiquidityMode
  });

  const {
    data: balancedQuote,
    isLoading: loadingBalancedQuote,
    isError: balanedQuoteError
  } = useChainScopedQuery({
    queryKey: [
      "wells",
      "quote",
      "removeLiquidity",
      well.address,
      removeLiquidityMode,
      lpTokenAmount
    ],

    queryFn: async () => {
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
    }
  });

  const {
    data: oneTokenQuote,
    isLoading: loadingOneTokenQuote,
    isError: oneTokenQuoteError
  } = useChainScopedQuery({
    queryKey: [
      "wells",
      "quote",
      "removeliquidity",
      well.address,
      removeLiquidityMode,
      lpTokenAmount,
      singleTokenIndex
    ],

    queryFn: async () => {
      if (removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken) {
        return null;
      }

      if (!lpTokenAmount || lpTokenAmount.eq(TokenValue.ZERO) || !address) {
        return null;
      }

      try {
        const quote = await well.removeLiquidityOneTokenQuote(
          lpTokenAmount,
          wellTokens![singleTokenIndex]
        );
        const estimate = await well.removeLiquidityOneTokenGasEstimate(
          lpTokenAmount,
          wellTokens![singleTokenIndex],
          quote,
          address
        );
        return {
          quote,
          estimate
        };
      } catch (error: any) {
        Log.module("useliquidityquote").error("Error during quote: ", (error as Error).message);
        return null;
      }
    },

    staleTime: 1000 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  const {
    data: customRatioQuote,
    isLoading: loadingCustomRatioQuote,
    isError: customRatioQuoteError
  } = useChainScopedQuery({
    queryKey: ["wells", "quote", "removeliquidity", well.address, removeLiquidityMode, amounts],

    queryFn: async () => {
      if (removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom) {
        return null;
      }

      if (!amounts || !oneAmountNonZero || !address) {
        return null;
      }

      try {
        let _amountsFilled = [];
        for (let i = 0; i < wellTokens.length; i++) {
          _amountsFilled[i] = !amounts[i] ? TokenValue.ZERO : amounts[i];
        }
        const quote = await well.removeLiquidityImbalancedQuote(_amountsFilled);
        const estimate = await well.removeLiquidityImbalancedEstimateGas(
          quote,
          _amountsFilled,
          address
        );
        return {
          quote,
          estimate
        };
      } catch (error: any) {
        Log.module("removeliquidity").error("Error during quote: ", (error as Error).message);
        return null;
      }
    },

    staleTime: 1000 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false
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
