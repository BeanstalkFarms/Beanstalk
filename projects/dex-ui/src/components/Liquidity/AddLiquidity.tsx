import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "../../components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { useAccount } from "wagmi";
import { AddLiquidityETH, Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { LIQUIDITY_OPERATION_TYPE, LiquidityAmounts } from "./types";
import { Button } from "../Swap/Button";
import { ensureAllowance, hasMinimumAllowance } from "./allowance";
import { Log } from "../../utils/logger";
import QuoteDetails from "./QuoteDetails";
import { TransactionToast } from "../TxnToast/TransactionToast";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { useWellReserves } from "src/wells/useWellReserves";
import { Checkbox } from "../Checkbox";
import { size } from "src/breakpoints";

type AddLiquidityProps = {
  well: Well;
  slippage: number;
  slippageSettingsClickHandler: () => void;
  handleSlippageValueChange: (value: string) => void;
};

export type AddLiquidityQuote = {
  quote: {
    quote: TokenValue[];
  };
  estimate: TokenValue;
};

export const AddLiquidity = ({
  well,
  slippage,
  slippageSettingsClickHandler,
  handleSlippageValueChange
}: AddLiquidityProps) => {
  const { address } = useAccount();
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const inputs = Object.values(amounts);

  const [balancedMode, setBalancedMode] = useState(true);
  // Indexed in the same order as well.tokens
  const [tokenAllowance, setTokenAllowance] = useState<boolean[]>([]);
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);

  const [hasEnoughBalance, setHasEnoughBalance] = useState(false);

  const sdk = useSdk();
  const { reserves: wellReserves, refetch: refetchWellReserves } = useWellReserves(well);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [useWETH, setUseWETH] = useState(false);
  
  useEffect(() => {
    const run = async () => {
      if (!well?.tokens) return;
      const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
      setPrices(prices);
    };
    run();
  }, [sdk, well?.tokens]);

  const atLeastOneAmountNonZero = useMemo(() => {
    if (!well.tokens || well.tokens.length === 0) return false;

    const nonZeroValues = inputs.filter((amount) => amount.value.gt("0")).length;
    return nonZeroValues !== 0;
  }, [inputs, well.tokens]);

  const hasWETH = useMemo(() => {
    if (!well.tokens || well.tokens.length === 0) return false;

    let isWETHPair = false;
    for (let i = 0; i < well.tokens.length; i++) {
      if (well.tokens[i].symbol === "WETH") {
        isWETHPair = true;
      }
    }
    return isWETHPair;
  }, [well.tokens]);

  const indexWETH = useMemo(() => {
    if (!hasWETH || !well.tokens || well.tokens.length === 0) return null;
    
    let index = null;
    for (let i = 0; i < well.tokens.length; i++) {
      if (well.tokens[i].symbol === "WETH") {
        return i;
      }
    }
    return index;
  }, [hasWETH, well.tokens])

  const useNativeETH = !useWETH && indexWETH && inputs[indexWETH] && inputs[indexWETH].gt(TokenValue.ZERO);

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

  const checkMinAllowanceForAllTokens = useCallback(async () => {
    if (!address) {
      return;
    }

    const _tokenAllowance = [];
    for (let [index, token] of well.tokens!.entries()) {
      const targetAddress = useNativeETH ? sdk.addresses.DEPOT.MAINNET : well.address;
      if (amounts[index]) {
        const tokenHasMinAllowance = await hasMinimumAllowance(address, targetAddress, token, amounts[index]);
        Log.module("AddLiquidity").debug(
          `Token ${token.symbol} with amount ${amounts[index].toHuman()} has approval ${tokenHasMinAllowance}`
        );
        if (token.symbol === "WETH" && !useWETH && hasWETH) {
          Log.module("AddLiquidity").debug(
            `Using Native ETH, no approval needed!`
          );
          _tokenAllowance.push(true);
        } else {
          _tokenAllowance.push(tokenHasMinAllowance);
        }
      } else {
        _tokenAllowance.push(false);
      }
    }
    setTokenAllowance(_tokenAllowance);
  }, [address, amounts, useNativeETH, well.address, sdk.addresses.DEPOT.MAINNET, hasWETH, useWETH, well.tokens]);

  // Once we have our first quote, we show the details.
  // Subsequent quote invocations shows a spinner in the Expected Output row
  const [showQuoteDetails, setShowQuoteDetails] = useState<boolean>(false);

  const resetAmounts = useCallback(() => {
    if (well.tokens) {
      const initialAmounts: LiquidityAmounts = {};
      for (let i = 0; i < well.tokens.length; i++) {
        initialAmounts[i] = TokenValue.ZERO;
      }

      setAmounts(initialAmounts);
    }
  }, [well.tokens, setAmounts]);

  useEffect(() => {
    if (well.tokens) {
      const initialAmounts: LiquidityAmounts = {};
      for (let i = 0; i < well.tokens.length; i++) {
        initialAmounts[i] = TokenValue.ZERO;
      }

      setAmounts(initialAmounts);
    }
  }, [well.tokens]);

  const allTokensHaveMinAllowance = useMemo(() => tokenAllowance.filter((a) => a === false).length === 0, [tokenAllowance]);

  const { data: quote } = useQuery(["wells", "quote", "addliquidity", address, amounts, allTokensHaveMinAllowance], async () => {
    if (!atLeastOneAmountNonZero) {
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
      return {
        quote,
        gas,
        estimate
      };
    } catch (error: any) {
      Log.module("addliquidity").error("Error during quote: ", (error as Error).message);
      return null;
    }
  },{
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
          addLiquidityTxn = await addLiquidityNativeETH.addLiquidity(well, inputs, quoteAmountLessSlippage, address, quote.estimate.mul(1.2));
        } else {
          addLiquidityTxn = await well.addLiquidity(inputs, quoteAmountLessSlippage, address, undefined, {
            gasLimit: quote.estimate.mul(1.2).toBigNumber()
          });
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
    }
  }, [quote, address, slippage, well, sdk.wells, inputs, useNativeETH, resetAmounts, checkMinAllowanceForAllTokens, refetchWellReserves]);

  const handleImbalancedInputChange = useCallback(
    (index: number) => (a: TokenValue) => {
      setAmounts({ ...amounts, [index]: a });
    },
    [amounts]
  );

  const handleBalancedInputChange = useCallback(
    (index: number) => (amount: TokenValue) => {
      if (!prices[index]) {
        setAmounts({ ...amounts, [index]: amount });
        return;
      }
      const amountInUSD = amount.mul(prices[index] || TokenValue.ZERO);
      let _amounts = [];
      for (let i = 0; i < prices.length; i++) {
        if (i !== index) {
          const conversion = prices[i] && prices[i]?.gt(TokenValue.ZERO) ? amountInUSD.div(prices[i]!) : TokenValue.ZERO;
          const conversionFormatted = TokenValue.fromHuman(conversion.humanString, well.tokens![i].decimals);
          _amounts[i] = conversionFormatted;
        } else {
          _amounts[i] = amount;
        }
      }
      setAmounts(Object.assign({}, _amounts));
    },
    [amounts, prices, well.tokens]
  );

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

      const targetAddress = useNativeETH ? sdk.addresses.DEPOT.MAINNET : well.address;
      await ensureAllowance(address, targetAddress, well.tokens[tokenIndex], amounts[tokenIndex]);
      checkMinAllowanceForAllTokens();
    },
    [address, well.tokens, amounts, useNativeETH, well.address, sdk.addresses.DEPOT.MAINNET, checkMinAllowanceForAllTokens]
  );

  const buttonLabel = useMemo(
    () => (!atLeastOneAmountNonZero ? "Enter Amount(s)" : !hasEnoughBalance ? "Insufficient Balance" : "Add Liquidity"),
    [atLeastOneAmountNonZero, hasEnoughBalance]
  );

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
                token={hasWETH && !useWETH && well.tokens![index].symbol === "WETH" ? sdk.tokens.ETH : well.tokens![index]}
                amount={amounts[index]}
                onAmountChange={balancedMode ? handleBalancedInputChange(index) : handleImbalancedInputChange(index)}
                canChangeToken={false}
                loading={false}
              />
            ))}
          </TokenListContainer>
          <div>
            <Checkbox label={"Add tokens in balanced proportion"} checked={balancedMode} onClick={() => setBalancedMode(!balancedMode)} />
            {hasWETH && (
              <Checkbox label={"Use Wrapped ETH"} checked={useWETH} onClick={() => setUseWETH(!useWETH)} />
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
            {well.tokens!.length > 0 && hasEnoughBalance &&
              well.tokens!.map((token: Token, index: number) => {
                if (amounts[index] && amounts[index].gt(TokenValue.ZERO) && tokenAllowance[index] === false) {
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
              <AddLiquidityButton
                disabled={!addLiquidityButtonEnabled}
                loading={false}
                label={`${buttonLabel} →`}
                onClick={addLiquidityButtonClickHandler}
              />
            </ButtonWrapper>
          </MediumGapContainer>
        </LargeGapContainer>
      )}
    </div>
  );
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
