import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { LiquidityAmounts } from "./types";
import { Button } from "../Swap/Button";
import gearIcon from "/src/assets/images/gear.svg";
import infoIcon from "/src/assets/images/info.svg";
import useSdk from "src/utils/sdk/useSdk";
import { formatEther } from "ethers/lib/utils.js";
import useEthPrice from "./useEthPrice";
import { ensureAllowance, hasMinimumAllowance } from "./allowance";
import { Log } from "src/utils/logger";

type AddLiquidityProps = {
  well: Well;
  txnCompleteCallback: () => void;
  slippage: number;
  slippageSettingsClickHandler: () => void;
};

export const AddLiquidity = ({ well, txnCompleteCallback, slippage, slippageSettingsClickHandler }: AddLiquidityProps) => {
  const { address } = useAccount();
  const sdk = useSdk();
  // TODO: This should be added to the main app provider I think, e.g. TokenProvider
  const ethPrice = useEthPrice();

  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const [receipt, setReceipt] = useState<ContractReceipt | null>(null);

  // Indexed in the same order as well.tokens
  const [tokenAllowance, setTokenAllowance] = useState<boolean[]>([]);

  const checkMinAllowanceForAllTokens = useCallback(async () => {
    if (!address) {
      return;
    }

    const _tokenAllowance = [];
    for (let [index, token] of well.tokens!.entries()) {
      // only check approval if this token has an amount gt zero
      if (amounts[index] && amounts[index].gt(0)) {
        const tokenHasMinAllowance = await hasMinimumAllowance(address, well.address, token, amounts[index].value.toBigNumber());
        Log.module("addliquidity").debug(`Token ${token.symbol} with amount ${amounts[index].toHuman()} has approval ${tokenHasMinAllowance}`);
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

  const atLeastOneAmountNonzero = useCallback(() => Object.values(amounts).filter((amount) => amount.value.gt("0")).length > 0, [amounts]);

  const resetAmounts = useCallback(() => {
    if (well.tokens) {
      const initialAmounts: LiquidityAmounts = {};
      for (let i = 0; i < well.tokens.length; i++) {
        initialAmounts[i] = TokenValue.ZERO;
      }

      setAmounts(initialAmounts);
    }
  }, [well.tokens]);

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
    if (!atLeastOneAmountNonzero()) {
      return null;
    }

    if (!allTokensHaveMinAllowance) {
      return null;
    }

    let quote: TokenValue;

    // so we show the quote details page on first quote
    setShowQuoteDetails(true);

    try {
      const quote = await well.addLiquidityQuote(Object.values(amounts));
      const estimate = await well.addLiquidityGasEstimate(Object.values(amounts), quote, address);
      return {
        quote,
        estimate
      };
    } catch (error: any) {
      Log.module("addliquidity").error("Error during quote: ", (error as Error).message);
      return null;
    }
  });

  const addLiquidityButtonClickHandler = useCallback(async () => {
    if (quote && address) {
      const quoteAmountLessSlippage = quote.quote.subSlippage(slippage);
      const addLiquidityTxn = await well.addLiquidity(Object.values(amounts), quoteAmountLessSlippage, address);
      const receipt = await addLiquidityTxn.wait();
      setReceipt(receipt);
      resetAmounts();
      checkMinAllowanceForAllTokens();
      txnCompleteCallback();
    }
  }, [quote, address, slippage, well, amounts, resetAmounts, checkMinAllowanceForAllTokens, txnCompleteCallback]);

  const handleInputChange = useCallback(
    (index: number) => (a: TokenValue) => {
      setAmounts({ ...amounts, [index]: a });
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

    if (!atLeastOneAmountNonzero) {
      return;
    }

    checkMinAllowanceForAllTokens();
  }, [well.tokens, address, atLeastOneAmountNonzero, amounts, checkMinAllowanceForAllTokens]);

  const addLiquidityButtonEnabled = useMemo(
    () => address && atLeastOneAmountNonzero() && allTokensHaveMinAllowance,
    [address, atLeastOneAmountNonzero, allTokensHaveMinAllowance]
  );

  const [gasFeeUsd, setGasFeeUsd] = useState<String>("");

  useEffect(() => {
    const getGasInUsd = async () => {
      const feeData = await sdk.provider.getFeeData();
      const gBn = quote?.estimate.toBigNumber();
      if (quote?.estimate && feeData.maxFeePerGas && gBn && ethPrice.data) {
        const txEthAmount = gBn.mul(feeData.maxFeePerGas);
        const txEthAmountNumber = formatEther(txEthAmount);
        const usd = parseFloat(ethPrice.data) * parseFloat(txEthAmountNumber);
        setGasFeeUsd(
          `~${usd.toLocaleString("en-US", {
            style: "currency",
            currency: "USD"
          })}`
        );
      }
    };

    getGasInUsd();
  }, [quote?.estimate, sdk.provider, ethPrice]);

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
      await ensureAllowance(address, well.address, well.tokens[tokenIndex], amounts[tokenIndex].value.toBigNumber());
      checkMinAllowanceForAllTokens();
    },
    [address, well.tokens, well.address, amounts, checkMinAllowanceForAllTokens]
  );

  const buttonLabel = useMemo(() => (!atLeastOneAmountNonzero() ? "Input Token Amount" : "Add Liquidity"), [atLeastOneAmountNonzero]);

  return (
    <div>
      {well.tokens!.length > 0 && (
        <div>
          <div>
            <TokenListContainer>
              {well.tokens?.map((token, index) => (
                <TokenInput
                  key={`input${index}`}
                  id={`input${index}`}
                  label={`Input amount in ${token.symbol}`}
                  token={well.tokens![index]}
                  amount={amounts[index]}
                  onAmountChange={handleInputChange(index)}
                  canChangeToken={false}
                  loading={false}
                />
              ))}
              <Divider />
            </TokenListContainer>
            {showQuoteDetails && (
              <QuoteContainer>
                <QuoteDetailLine>
                  <QuoteDetailLabel bold>Expected Output</QuoteDetailLabel>
                  <QuoteDetailValue bold>{quote ? quote.quote.toHuman("0,0.0000") + " " + well.lpToken?.symbol : "-"}</QuoteDetailValue>
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
            )}
            {/* // TODO: Should be a notification */}
            {receipt && <h2>{`txn hash: ${receipt.transactionHash.substring(0, 6)}...`}</h2>}
            {well.tokens!.length > 0 &&
              well.tokens!.map((token, index) => {
                if (!tokenAllowance[index] && amounts[index]) {
                  return (
                    <ButtonWrapper>
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

                return <></>;
              })}
            <ButtonWrapper>
              <AddLiquidityButton
                disabled={!addLiquidityButtonEnabled}
                loading={false}
                label={buttonLabel}
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
`;

const ApproveTokenButton = styled(Button)`
  margin-bottom: 10px;
`;

const GearImage = styled.img`
  margin-left: 10px;
`;

type QuoteDetailProps = {
  bold?: boolean;
};

const QuoteDetailLabel = styled.div<QuoteDetailProps>`
  align-items: flex-start;
  width: 50%;
  font-weight: ${(props) => (props.bold ? "bold" : "normal")};
`;

const QuoteDetailValue = styled.div<QuoteDetailProps>`
  align-items: flex-end;
  text-align: right;
  width: 50%;
  font-weight: ${(props) => (props.bold ? "bold" : "normal")};
`;

const QuoteDetailLine = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  margin-top: 10px;
  margin-bottom: 10px;
`;

const QuoteContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 10px;
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
  width: 465px;
  display: flex;
  flex-direction: column;
  background: #1b1e2b;
  border-radius: 16px;
  padding: 12px;
  gap: 12px;
`;
