import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "../../components/Swap/TokenInput";
import { ChainId, ERC20Token, Token, TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { useAccount, useChainId } from "wagmi";
import { AddLiquidityETH, Well } from "@beanstalk/sdk-wells";
import { useQuery } from "@tanstack/react-query";
import { LIQUIDITY_OPERATION_TYPE, LiquidityAmounts } from "./types";
import { Button } from "../Swap/Button";
import { ensureAllowance, hasMinimumAllowance } from "./allowance";
import { Log } from "../../utils/logger";
import QuoteDetails from "./QuoteDetails";
import { TransactionToast } from "../TxnToast/TransactionToast";
import useSdk from "src/utils/sdk/useSdk";
import { useWellReserves } from "src/wells/useWellReserves";
import { Checkbox } from "../Checkbox";
import { size } from "src/breakpoints";
import { LoadingTemplate } from "src/components/LoadingTemplate";
import { ActionWalletButtonWrapper } from "src/components/Wallet";
import { useTokenPrices } from "src/utils/price/useTokenPrices";
import { PriceLookups } from "src/utils/price/priceLookups";
import { useInvalidateScopedQueries } from "src/utils/query/useInvalidateQueries";
import { queryKeys } from "src/utils/query/queryKeys";

type BaseAddLiquidityProps = {
  slippage: number;
  slippageSettingsClickHandler: () => void;
  handleSlippageValueChange: (value: string) => void;
};

type AddLiquidityProps = {
  /**
   * Well
   */
  well: Well;
  /**
   * Well Tokens (Non Nullable)
   */
  tokens: ERC20Token[];
} & BaseAddLiquidityProps;

export type AddLiquidityQuote = {
  quote: {
    quote: TokenValue[];
  };
  estimate: TokenValue;
};

const AddLiquidityContent = ({
  well,
  tokens,
  slippage,
  slippageSettingsClickHandler,
  handleSlippageValueChange
}: AddLiquidityProps) => {
  const { address } = useAccount();
  const sdk = useSdk();
  const chainId = useChainId();

  const WETH = sdk.tokens.WETH;
  const token1 = tokens[0];
  const token2 = tokens[1];

  // Local State
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const [balancedMode, setBalancedMode] = useState(true);
  const [useWETH, setUseWETH] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasEnoughBalance, setHasEnoughBalance] = useState(false);

  const inputs = Object.values(amounts);

  /// Queries
  const { reserves: wellReserves, refetch: refetchWellReserves } = useWellReserves(well);
  const { data: prices = [] } = useTokenPrices(well, {
    refetchInterval: 15 * 1000,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: "always",
    select: (data) => {
      return [data[token1.symbol] || null, data[token2.symbol] || null]; // price indexed by token symbol
    }
  });
  const invalidate = useInvalidateScopedQueries();

  // Indexed in the same order as well.tokens
  const [tokenAllowance, setTokenAllowance] = useState<boolean[]>([]);

  const canFetchPrice1 = !!(token1 && token1.symbol in PriceLookups);
  const canFetchPrice2 = !!(token2 && token2.symbol in PriceLookups);
  const canFetchPrices = Boolean(canFetchPrice1 && canFetchPrice2 && prices.length === 2);

  const someWellReservesEmpty = Boolean(
    wellReserves && wellReserves.some((reserve) => reserve.eq(0))
  );
  const areSomeInputsZero = Boolean(inputs.some((amt) => amt.value.eq("0")));

  const atLeastOneAmountNonZero = useMemo(() => {
    if (!well.tokens || well.tokens.length === 0) return false;

    const nonZeroValues = inputs.filter((amount) => amount.value.gt("0")).length;
    return nonZeroValues !== 0;
  }, [inputs, well.tokens]);

  const hasWETH = useMemo(() => {
    if (!well.tokens || !well.tokens.length) return false;
    return Boolean(well.tokens.some((tk) => tk.symbol === WETH.symbol));
  }, [well.tokens, WETH]);

  const indexWETH = useMemo(() => {
    if (!hasWETH || !well.tokens || !well.tokens.length) return null;
    const index = well.tokens.findIndex((tk) => tk.symbol === WETH.symbol);
    return index >= 0 ? index : null;
  }, [hasWETH, well.tokens, WETH]);

  const useNativeETH =
    !useWETH && indexWETH && inputs[indexWETH] && inputs[indexWETH].gt(TokenValue.ZERO);

  // Check Balances
  useEffect(() => {
    const checkBalances = async () => {
      if (!address || !well.tokens) {
        setHasEnoughBalance(false);
        return;
      }

      let insufficientBalances = false;

      for await (const [index, amount] of Object.entries(amounts)) {
        const token = well.tokens[Number(index)];
        if (amount.eq(TokenValue.ZERO)) {
          continue;
        }
        let balance;
        if (token.symbol === "WETH" && !useWETH) {
          balance = await sdk.tokens.ETH.getBalance(address);
        } else {
          balance = await token.getBalance(address);
        }
        if (amount.gt(balance)) {
          insufficientBalances = true;
          break;
        }
      }
      setHasEnoughBalance(!insufficientBalances);
    };

    checkBalances();
  }, [address, amounts, sdk.tokens.ETH, useWETH, well.tokens]);

  // check allowances
  const checkMinAllowanceForAllTokens = useCallback(async () => {
    if (!address) {
      return;
    }

    const _tokenAllowance = [];
    for (let [index, token] of well.tokens!.entries()) {
      const targetAddress = useNativeETH ? sdk.addresses.DEPOT.get(chainId) : well.address;
      if (amounts[index]) {
        const tokenHasMinAllowance = await hasMinimumAllowance(
          address,
          targetAddress,
          token,
          amounts[index]
        );
        Log.module("AddLiquidity").debug(
          `Token ${token.symbol} with amount ${amounts[index].toHuman()} has approval ${tokenHasMinAllowance}`
        );
        if (token.symbol === "WETH" && !useWETH && hasWETH) {
          Log.module("AddLiquidity").debug(`Using Native ETH, no approval needed!`);
          _tokenAllowance.push(true);
        } else {
          _tokenAllowance.push(tokenHasMinAllowance);
        }
      } else {
        _tokenAllowance.push(false);
      }
    }
    setTokenAllowance(_tokenAllowance);
  }, [
    address,
    amounts,
    useNativeETH,
    well.address,
    sdk.addresses.DEPOT,
    chainId,
    hasWETH,
    useWETH,
    well.tokens
  ]);

  // Once we have our first quote, we show the details.
  // Subsequent quote invocations shows a spinner in the Expected Output row
  const [showQuoteDetails, setShowQuoteDetails] = useState<boolean>(false);

  const resetAmounts = useCallback(() => {
    setAmounts({
      0: token1.amount(0),
      1: token2.amount(0)
    });
  }, [token1, token2]);

  // reset the amounts from the beginning
  useEffect(() => {
    resetAmounts();
  }, [resetAmounts]);

  const allTokensHaveMinAllowance = useMemo(
    () => tokenAllowance.filter((a) => a === false).length === 0,
    [tokenAllowance]
  );

  const { data: quote } = useQuery({
    queryKey: ["wells", "quote", "addliquidity", address, amounts, allTokensHaveMinAllowance],

    queryFn: async () => {
      if ((someWellReservesEmpty && areSomeInputsZero) || !atLeastOneAmountNonZero) {
        setShowQuoteDetails(false);
        return null;
      }
      try {
        let quote;
        let estimate;
        let gas;
        quote = await well.addLiquidityQuote(inputs);

        if (allTokensHaveMinAllowance && tokenAllowance.length) {
          if (useNativeETH) {
            const addLiq = new AddLiquidityETH(sdk.wells);
            estimate = await addLiq.doGasEstimate(well, inputs, quote, address);
          } else {
            estimate = await well.addLiquidityGasEstimate(inputs, quote, address);
          }
        } else {
          estimate = TokenValue.ZERO;
        }

        setShowQuoteDetails(true);

        gas = estimate;
        return { quote, gas, estimate };
      } catch (error: any) {
        Log.module("addliquidity").error("Error during quote: ", (error as Error).message);
        return null;
      }
    },

    enabled: !isSubmitting
  });

  const addLiquidityButtonClickHandler = useCallback(async () => {
    if (quote && address) {
      const toast = new TransactionToast({
        loading: "Adding liquidity...",
        error: "Adding liquidity failed",
        success: "Liquidity added"
      });
      try {
        setIsSubmitting(true);
        const quoteAmountLessSlippage = quote.quote.subSlippage(slippage);
        let addLiquidityTxn;
        if (useNativeETH) {
          const addLiquidityNativeETH = new AddLiquidityETH(sdk.wells);
          addLiquidityTxn = await addLiquidityNativeETH.addLiquidity(
            well,
            inputs,
            quoteAmountLessSlippage,
            address,
            quote.estimate.mul(1.2)
          );
        } else {
          addLiquidityTxn = await well.addLiquidity(
            inputs,
            quoteAmountLessSlippage,
            address,
            undefined,
            {
              gasLimit: quote.estimate.mul(1.2).toBigNumber()
            }
          );
        }
        toast.confirming(addLiquidityTxn);
        const receipt = await addLiquidityTxn.wait();
        toast.success(receipt);
        resetAmounts();
        checkMinAllowanceForAllTokens();
        refetchWellReserves();
        setIsSubmitting(false);
      } catch (error) {
        Log.module("AddLiquidity").error("Error adding liquidity: ", (error as Error).message);
        toast.error(error);
        setIsSubmitting(false);
      }
      invalidate(queryKeys.tokenBalance(token1.address));
      invalidate(queryKeys.tokenBalance(token2.address));
      invalidate(queryKeys.lpSummaryAll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quote,
    address,
    slippage,
    well,
    sdk.wells,
    inputs,
    useNativeETH,
    resetAmounts,
    checkMinAllowanceForAllTokens,
    refetchWellReserves
  ]);

  const handleImbalancedInputChange = useCallback(
    (index: number) => (a: TokenValue) => {
      const newAmounts = { ...amounts, [index]: a };
      setAmounts(newAmounts);
    },
    [amounts]
  );

  const handleBalancedInputChange = useCallback(
    (index: number) => (amount: TokenValue) => {
      if (!canFetchPrices || !prices) {
        setAmounts({ ...amounts, [index]: amount });
        console.log("inbalanced mode...");
        return;
      }
      const amountInUSD = amount.mul(prices[index] || TokenValue.ZERO);
      let _amounts = [];
      for (let i = 0; i < prices.length; i++) {
        if (i !== index) {
          const conversion =
            prices[i] && prices[i]?.gt(TokenValue.ZERO)
              ? amountInUSD.div(prices[i]!)
              : TokenValue.ZERO;
          const conversionFormatted = TokenValue.fromHuman(
            conversion.humanString,
            well.tokens![i].decimals
          );
          _amounts[i] = conversionFormatted;
        } else {
          _amounts[i] = amount;
        }
      }
      setAmounts(Object.assign({}, _amounts));
    },
    [amounts, canFetchPrices, prices, well.tokens]
  );

  const toggleBalanceMode = useCallback(() => {
    const newMode = !balancedMode;

    setBalancedMode(newMode);

    /// if we are toggling balancedMode to false, no need to handle re-balancing.
    if (!newMode) return;

    if (amounts[0] && amounts[1]) {
      /// If both are zero, already balanced
      if (amounts[0].eq(0) && amounts[1].eq(0)) return;

      /// If amount1 is non-zero, re-balance to amount1, otherwise, re-balance to amount2
      const nonZeroValueIndex = Number(!amounts[0].gt(0));

      /// This fires even though the value is the same, so we need to check if it's actually changed
      handleBalancedInputChange(nonZeroValueIndex)(amounts[nonZeroValueIndex]);
    }
  }, [balancedMode, amounts, handleBalancedInputChange]);

  useEffect(() => {
    if (!address) {
      return;
    }
    if (!well.tokens) {
      return;
    }

    if (!atLeastOneAmountNonZero) {
      return;
    }

    checkMinAllowanceForAllTokens();
  }, [well.tokens, address, atLeastOneAmountNonZero, amounts, checkMinAllowanceForAllTokens]);

  const addLiquidityButtonEnabled = useMemo(
    () => address && atLeastOneAmountNonZero && allTokensHaveMinAllowance && hasEnoughBalance,
    [address, atLeastOneAmountNonZero, allTokensHaveMinAllowance, hasEnoughBalance]
  );

  const approveTokenButtonClickHandler = useCallback(
    (tokenIndex: number) => async () => {
      if (!address || !well.tokens || !amounts) return;

      const targetAddress = useNativeETH ? sdk.addresses.DEPOT.get(chainId) : well.address;
      await ensureAllowance(address, targetAddress, well.tokens[tokenIndex], amounts[tokenIndex]);
      checkMinAllowanceForAllTokens();
    },
    [
      address,
      well.tokens,
      amounts,
      useNativeETH,
      well.address,
      sdk.addresses.DEPOT,
      chainId,
      checkMinAllowanceForAllTokens
    ]
  );

  const buttonLabel = useMemo(() => {
    if (!address) return "Connect Wallet";
    if (!hasEnoughBalance) return "Insufficient Balance";
    if (!atLeastOneAmountNonZero) return "Enter Amount(s)";
    if (someWellReservesEmpty && areSomeInputsZero) return "Both Amounts Required";
    return "Add Liquidity";
  }, [
    atLeastOneAmountNonZero,
    hasEnoughBalance,
    address,
    someWellReservesEmpty,
    areSomeInputsZero
  ]);

  return (
    <div>
      {well.tokens!.length > 0 && (
        <LargeGapContainer>
          <TokenListContainer>
            {well.tokens?.map((token: Token, index: number) => (
              <TokenInput
                key={`input${index}`}
                id={`input${index}`}
                label={`Input amount in ${token.symbol}`}
                token={
                  hasWETH && !useWETH && tokens[index].equals(WETH) ? sdk.tokens.ETH : tokens[index]
                }
                amount={amounts[index]}
                onAmountChange={
                  balancedMode && canFetchPrices
                    ? handleBalancedInputChange(index)
                    : handleImbalancedInputChange(index)
                }
                canChangeToken={false}
                loading={false}
              />
            ))}
          </TokenListContainer>
          <div>
            {canFetchPrices && (
              <Checkbox
                label={"Add tokens in balanced proportion"}
                checked={balancedMode}
                onClick={() => toggleBalanceMode()}
              />
            )}
            {hasWETH && (
              <Checkbox
                label={"Use Wrapped ETH"}
                checked={useWETH}
                onClick={() => setUseWETH(!useWETH)}
              />
            )}
          </div>
          {showQuoteDetails && (
            <QuoteDetails
              type={LIQUIDITY_OPERATION_TYPE.ADD}
              quote={quote}
              inputs={inputs}
              wellLpToken={well.lpToken}
              slippageSettingsClickHandler={slippageSettingsClickHandler}
              handleSlippageValueChange={handleSlippageValueChange}
              slippage={slippage}
              tokenPrices={prices}
              tokenReserves={wellReserves}
            />
          )}
          <MediumGapContainer>
            {well.tokens!.length > 0 &&
              hasEnoughBalance &&
              well.tokens!.map((token: Token, index: number) => {
                if (
                  amounts[index] &&
                  amounts[index].gt(TokenValue.ZERO) &&
                  tokenAllowance[index] === false
                ) {
                  return (
                    <ButtonWrapper key={`approvebuttonwrapper${index}`} heightIndex={index + 1}>
                      <ApproveTokenButton
                        key={`approvebutton${index}`}
                        disabled={amounts && amounts[index].lte(0)}
                        loading={false}
                        label={`Approve ${token.symbol}`}
                        onClick={approveTokenButtonClickHandler(index)}
                      />
                    </ButtonWrapper>
                  );
                }
                return null;
              })}
            <ButtonWrapper>
              <ActionWalletButtonWrapper>
                <AddLiquidityButton
                  disabled={!addLiquidityButtonEnabled}
                  loading={false}
                  label={`${buttonLabel} →`}
                  onClick={addLiquidityButtonClickHandler}
                />
              </ActionWalletButtonWrapper>
            </ButtonWrapper>
          </MediumGapContainer>
        </LargeGapContainer>
      )}
    </div>
  );
};

const AddLiquidityLoading = () => (
  <div>
    <LargeGapContainer>
      <LoadingTemplate.Flex gap={12}>
        <LoadingTemplate.Input />
        <LoadingTemplate.Input />
      </LoadingTemplate.Flex>
      <LoadingTemplate.Flex gap={8}>
        <LoadingTemplate.Item height={20} width={285} />
        <LoadingTemplate.Item height={20} width={145} />
      </LoadingTemplate.Flex>
      <ButtonWrapper>
        <LoadingTemplate.Button />
      </ButtonWrapper>
    </LargeGapContainer>
  </div>
);

export const AddLiquidity: React.FC<
  BaseAddLiquidityProps & { well: Well | undefined; loading: boolean }
> = ({ well, ...props }) => {
  if (!well || props.loading || !well.tokens || well.tokens.length < 2) {
    return <AddLiquidityLoading />;
  }

  return <AddLiquidityContent {...props} well={well} tokens={well.tokens} />;
};

const LargeGapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  @media (max-width: ${size.mobile}) {
    margin-bottom: 40px;
  }
`;

const MediumGapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ButtonWrapper = styled.div<{ heightIndex?: number }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  @media (max-width: ${size.mobile}) {
    position: fixed;
    width: calc(100% - 24px);
    margin-bottom: 0;
    bottom: ${({ heightIndex }) => (heightIndex ? `calc(12px + (48px * ${heightIndex}))` : "12px")};
  }
`;

const ApproveTokenButton = styled(Button)`
  margin-bottom: 10px;
`;

const AddLiquidityButton = styled(Button)``;

const TokenListContainer = styled.div`
  width: full;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
