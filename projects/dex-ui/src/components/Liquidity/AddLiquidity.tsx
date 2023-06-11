import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "../../components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { LIQUIDITY_OPERATION_TYPE, LiquidityAmounts } from "./types";
import { Button } from "../Swap/Button";
import { ensureAllowance, hasMinimumAllowance } from "./allowance";
import { Log } from "../../utils/logger";
import QuoteDetails from "./QuoteDetails";
import { TransactionToast } from "../TxnToast/TransactionToast";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";

type AddLiquidityProps = {
  well: Well;
  txnCompleteCallback: () => void;
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

export const AddLiquidity = ({ well, txnCompleteCallback, slippage, slippageSettingsClickHandler, handleSlippageValueChange }: AddLiquidityProps) => {
  const { address } = useAccount();
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const [balancedMode, setBalancedMode] = useState(true);

  // Indexed in the same order as well.tokens
  const [tokenAllowance, setTokenAllowance] = useState<boolean[]>([]);
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);

  const sdk = useSdk();

  useEffect(() => {
    const run = async () => {
      if (!well) return
      if (well.tokens) {
        const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
        setPrices(prices);
      }
    };
    run();
  }, [sdk, well?.tokens]);

  const bothAmountsNonZero = useMemo(() => {
    if (!well.tokens) {
      return false;
    }

    if (well.tokens.length === 0) {
      return false;
    }

    const nonZeroValues = Object.values(amounts).filter((amount) => amount.value.gt("0")).length;

    return nonZeroValues === well.tokens?.length;
  }, [amounts, well.tokens]);

  const checkMinAllowanceForAllTokens = useCallback(async () => {
    if (!address) {
      return;
    }

    const _tokenAllowance = [];
    for (let [index, token] of well.tokens!.entries()) {
      // only check approval if this token has an amount gt zero
      if (amounts[index] && amounts[index].gt(0)) {
        const tokenHasMinAllowance = await hasMinimumAllowance(address, well.address, token, amounts[index]);
        Log.module("AddLiquidity").debug(
          `Token ${token.symbol} with amount ${amounts[index].toHuman()} has approval ${tokenHasMinAllowance}`
        );
        _tokenAllowance.push(tokenHasMinAllowance);
      } else {
        _tokenAllowance.push(false);
      }
    }
    setTokenAllowance(_tokenAllowance);
  }, [address, amounts, well.address, well.tokens]);

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
    if (!bothAmountsNonZero) {
      setShowQuoteDetails(false);
      return null;
    }

    if (!allTokensHaveMinAllowance) {
      setShowQuoteDetails(false);
      return null;
    }

    try {
      const quote = await well.addLiquidityQuote(Object.values(amounts));
      const estimate = await well.addLiquidityGasEstimate(Object.values(amounts), quote, address);
      setShowQuoteDetails(true);
      return {
        quote,
        estimate
      };
    } catch (error: any) {
      Log.module("addliquidity").error("Error during quote: ", (error as Error).message);
      setShowQuoteDetails(false);
      return null;
    }
  });

  const addLiquidityButtonClickHandler = useCallback(async () => {
    if (quote && address) {
      const toast = new TransactionToast({
        loading: "Adding liquidity...",
        error: "Approval failed",
        success: "Liquidity added"
      }); 
      try {
        const quoteAmountLessSlippage = quote.quote.subSlippage(slippage);
        const addLiquidityTxn = await well.addLiquidity(Object.values(amounts), quoteAmountLessSlippage, address);
        toast.confirming(addLiquidityTxn);
        const receipt = await addLiquidityTxn.wait();
        toast.success(receipt);
        resetAmounts();
        checkMinAllowanceForAllTokens();
        txnCompleteCallback(); 
      } catch (error) {
        Log.module("AddLiquidity").error("Error adding liquidity: ", (error as Error).message);
        toast.error(error);
      }
    }
  }, [quote, address, slippage, well, amounts, resetAmounts, checkMinAllowanceForAllTokens, txnCompleteCallback]);

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
        return
      };
      const amountInUSD = amount.mul(prices[index]!);
      let _amounts = [];
      for (let i = 0; i < prices.length; i++) {
        if (i !== index) {
          const conversion = amountInUSD.div(prices[i]!)
          _amounts[i] = conversion
        } else {
          _amounts[i] = amount
        };
      };
      setAmounts(Object.assign({}, _amounts));
    },
    [amounts]
  );

  useEffect(() => {
    if (!address) {
      return;
    }
    if (!well.tokens) {
      return;
    }

    if (!bothAmountsNonZero) {
      return;
    }

    checkMinAllowanceForAllTokens();
  }, [well.tokens, address, bothAmountsNonZero, amounts, checkMinAllowanceForAllTokens]);

  const addLiquidityButtonEnabled = useMemo(
    () => address && bothAmountsNonZero && allTokensHaveMinAllowance,
    [address, bothAmountsNonZero, allTokensHaveMinAllowance]
  );

  const approveTokenButtonClickHandler = useCallback(
    (tokenIndex: number) => async () => {
      if (!address) {
        return;
      }

      if (!well.tokens) {
        return;
      }

      if (!amounts) {
        return;
      }
      await ensureAllowance(address, well.address, well.tokens[tokenIndex], amounts[tokenIndex]);
      checkMinAllowanceForAllTokens();
    },
    [address, well.tokens, well.address, amounts, checkMinAllowanceForAllTokens]
  );

  const buttonLabel = useMemo(() => (!bothAmountsNonZero ? "Input Tokens" : "Add Liquidity"), [bothAmountsNonZero]);

  return (
    <div>
      {well.tokens!.length > 0 && (
        <div>
          <div>
            <TokenListContainer>
              {well.tokens?.map((token: Token, index: number) => (
                <TokenInput
                  key={`input${index}`}
                  id={`input${index}`}
                  label={`Input amount in ${token.symbol}`}
                  token={well.tokens![index]}
                  amount={amounts[index]}
                  onAmountChange={balancedMode ? handleBalancedInputChange(index) : handleImbalancedInputChange(index)}
                  canChangeToken={false}
                  loading={false}
                />
              ))}
            </TokenListContainer>
            <BalancedCheckboxContainer>
              <BalancedCheckbox
                type="checkbox"
                checked={balancedMode}
                onChange={() =>
                  setBalancedMode(!balancedMode)
                }
              />
              <TabLabel
                onClick={() =>
                  setBalancedMode(!balancedMode)
                }
              >
                Add tokens in balanced proportion
              </TabLabel>
            </BalancedCheckboxContainer>
            {showQuoteDetails && (
              <QuoteDetails
                type={LIQUIDITY_OPERATION_TYPE.ADD}
                quote={quote}
                wellLpToken={well.lpToken}
                slippageSettingsClickHandler={slippageSettingsClickHandler}
                handleSlippageValueChange={handleSlippageValueChange}
                slippage={slippage}
              />
            )}
            {well.tokens!.length > 0 &&
              well.tokens!.map((token: Token, index: number) => {
                if (amounts[index] && amounts[index].gt(TokenValue.ZERO) && tokenAllowance[index] === false ) {
                  return (
                    <ButtonWrapper key={`approvebuttonwrapper${index}`}>
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
          </div>
        </div>
      )}
    </div>
  );
};

const ButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 10px;
  :last-of-type {
    margin-bottom: 0;
  }
  margin-top: 10px;
`;

const ApproveTokenButton = styled(Button)`
  margin-bottom: 10px;
`;

const AddLiquidityButton = styled(Button)``;

const Divider = styled.hr`
  width: 100%;
  background-color: #000;
  border: none;
  height: 2px;
`;

const TokenListContainer = styled.div`
  width: full;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const BalancedCheckboxContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const BalancedCheckbox = styled.input`
  margin-right: 10px;
  width: 1em;
  height: 1em;
  background-color: white;

  :checked {
    background-color: red;
  }
`;

const TabLabel = styled.div`
  cursor: pointer;
`;