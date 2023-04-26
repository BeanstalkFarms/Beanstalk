import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { Token, TokenValue } from "@beanstalk/sdk";
import { useCallback } from "react";
import { LiquidityAmounts, REMOVE_LIQUIDITY_MODE } from "src/components/Liquidity/types";

export const useLiquidityQuote = (
  well: Well,
  removeLiquidityMode: REMOVE_LIQUIDITY_MODE,
  lpTokenAmount: TokenValue,
  singleTokenIndex: number,
  wellTokens: Token[],
  amounts: LiquidityAmounts
) => {
  const atLeastOneAmountNonzero = useCallback(() => Object.values(amounts).filter((amount) => amount.value.gt("0")).length > 0, [amounts]);

  const {
    data: balancedQuote,
    isLoading: loadingBalancedQuote,
    isError: balanedQuoteError
  } = useQuery(["wells", well.address, removeLiquidityMode, lpTokenAmount], async () => {
    if (!lpTokenAmount || removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Balanced) {
      return null;
    }

    return well.removeLiquidityQuote(lpTokenAmount);
  });

  const {
    data: oneTokenQuote,
    isLoading: loadingOneTokenQuote,
    isError: oneTokenQuoteError
  } = useQuery(["wells", well.address, removeLiquidityMode, lpTokenAmount, singleTokenIndex], async () => {
    if (removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.OneToken) {
      return null;
    }

    if (!lpTokenAmount) {
      return null;
    }

    return well.removeLiquidityOneTokenQuote(lpTokenAmount, wellTokens![singleTokenIndex]);
  });

  const {
    data: customRatioQuote,
    isLoading: loadingCustomRatioQuote,
    isError: customRatioQuoteError
  } = useQuery(["wells", well.address, removeLiquidityMode, amounts], async () => {
    if (removeLiquidityMode !== REMOVE_LIQUIDITY_MODE.Custom) {
      return null;
    }

    if (!amounts) {
      return null;
    }

    if (!atLeastOneAmountNonzero()) {
      return null;
    }

    return well.removeLiquidityImbalancedQuote(Object.values(amounts));
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
