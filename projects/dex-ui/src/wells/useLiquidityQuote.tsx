import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { Token, TokenValue } from "@beanstalk/sdk";
import { useMemo } from "react";
import { LiquidityAmounts, REMOVE_LIQUIDITY_MODE } from "src/components/Liquidity/types";
import { Log } from "src/utils/logger";
import { useAccount } from "wagmi";

export const useLiquidityQuote = (
  well: Well,
  removeLiquidityMode: REMOVE_LIQUIDITY_MODE,
  lpTokenAmount: TokenValue,
  singleTokenIndex: number,
  wellTokens: Token[],
  amounts: LiquidityAmounts,
  onQuoteHandler: () => void,
) => {
  const { address } = useAccount();

  const bothAmountsNonZero = useMemo(
    () => {
      if (!well.tokens) {
        return false;
      }

      if (well.tokens.length === 0) {
        return false;
      }

      const nonZeroValues = Object.values(amounts).filter((amount) => amount.value.gt("0")).length;
      
      return nonZeroValues === well.tokens?.length;
    },
    [amounts, well.tokens]
  );

  Log.module("useLiquidityQuote").debug("amounts:", amounts);
  Log.module("useLiquidityQuote").debug("bothAmountsNonZero:", bothAmountsNonZero);
  Log.module("useLiquidityQuote").debug("removeLiquidityMode:", removeLiquidityMode);

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

    onQuoteHandler();

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

    if (!lpTokenAmount || !address) {
      return null;
    }

    onQuoteHandler();

    try {
      const quote = await well.removeLiquidityOneTokenQuote(lpTokenAmount, wellTokens![singleTokenIndex]);
      const estimate = await well.removeLiquidityOneTokenGasEstimate(lpTokenAmount, wellTokens![singleTokenIndex], quote, address);
      return {
        quote,
        estimate
      };
    } catch (error: any) {
      Log.module("useLiquidityQuote").error("Error during quote: ", (error as Error).message);
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

    if (!amounts || !bothAmountsNonZero || !address) {
      return null;
    }

    onQuoteHandler();

    try {
      const quote = await well.removeLiquidityImbalancedQuote(Object.values(amounts));
      const estimate = await well.removeLiquidityImbalancedEstimateGas(quote, Object.values(amounts), address);
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
