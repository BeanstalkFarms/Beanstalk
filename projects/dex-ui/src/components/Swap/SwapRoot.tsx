import { Token, TokenValue } from "@beanstalk/sdk";
import React, { useCallback, useEffect, useState } from "react";
import { useTokens } from "src/tokens/TokenProvider";
import styled from "styled-components";
import { ArrowButton } from "./ArrowButton";
import { TokenInput } from "./TokenInput";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { useSwapBuilder } from "./useSwapBuilder";
import { useAccount } from "wagmi";
import { Quote, QuoteResult } from "@beanstalk/sdk/Wells";
import { Button } from "./Button";
import { Log } from "src/utils/logger";
import { useSearchParams } from "react-router-dom";
import { TransactionToast } from "../TxnToast/TransactionToast";
import QuoteDetails from "../Liquidity/QuoteDetails";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";

export const SwapRoot = () => {
  const { address: account } = useAccount();
  const sdk = useSdk();

  const [tokenSwapParams, setTokenSwapParams] = useSearchParams();
  const fromToken = tokenSwapParams.get("fromToken");
  const toToken = tokenSwapParams.get("toToken");

  const tokens = useTokens();
  const [inAmount, setInAmount] = useState<TokenValue>();
  const [inToken, setInToken] = useState<Token>(fromToken ? (tokens[fromToken] ? tokens[fromToken] : tokens["WETH"]) : tokens["WETH"]);
  const [outToken, setOutToken] = useState<Token>(toToken ? (tokens[toToken] ? tokens[toToken] : tokens["BEAN"]) : tokens["BEAN"]);
  const [outAmount, setOutAmount] = useState<TokenValue>();
  const [slippage, setSlippage] = useState<number>(0.1);
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);
  const { isLoading: isAllTokenLoading } = useAllTokensBalance();
  const [quoter, setQuoter] = useState<Quote | null>(null);
  const [isForwardQuote, setIsForwardQuote] = useState<boolean>(true);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [readyToSwap, setReadyToSwap] = useState(false);
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);
  const [hasEnoughBalance, setHasEnoughBalance] = useState<boolean>(false);

  const [quote, setQuote] = useState<QuoteResult | undefined>();
  const builder = useSwapBuilder();

  useEffect(() => {
    const run = async () => {
      if (!inToken || !outToken) return;
      let inTokenPrice = await getPrice(inToken, sdk);
      let outTokenPrice = await getPrice(outToken, sdk);
      setPrices([inTokenPrice, outTokenPrice]);
    };
    run();
  }, [sdk, inToken, outToken]);

  // Fetch all tokens. Needed for populating the token selector dropdowns
  useEffect(() => {
    const fetching = isAllTokenLoading;
    fetching ? setIsLoadingAllBalances(true) : setTimeout(() => setIsLoadingAllBalances(false), 500);
  }, [isAllTokenLoading]);

  // Builds a Quoter object. Dependency array updates it when those change
  useEffect(() => {
    const quoter = builder?.buildQuote(inToken, outToken, account || "");
    setQuoter(quoter ?? null);
  }, [inToken, outToken, builder, account]);

  useEffect(() => {
    readyToSwap && hasEnoughBalance && !!account ? setButtonEnabled(true) : setButtonEnabled(false);
  }, [readyToSwap, account, hasEnoughBalance]);

  const arrowHandler = () => {
    const prevInToken = inToken;
    const prevInAmount = inAmount;

    setInToken(outToken);
    setInAmount(outAmount);
    setOutToken(prevInToken);
    setOutAmount(prevInAmount);
  };

  const checkBalance = useCallback(
    async (token: Token, amount: TokenValue): Promise<boolean> => {
      // return true here to support doing quotes without having an account connected.
      // Other checks will make sure the swap button is disabled
      if (!account) return true;

      const balance = await token.getBalance(account);
      const enough = balance.gte(amount);
      Log.module("swap").debug(`Has enough ${token.symbol}? `, enough);

      return enough;
    },
    [account]
  );

  const handleInputChange = useCallback(
    async (amount: TokenValue) => {
      setInAmount(amount);
      setIsForwardQuote(true);
      if (amount.eq(0)) {
        setOutAmount(outToken.amount(0));
        setQuote(undefined);
        return;
      }

      try {
        const quote = await quoter?.quoteForward(amount, account!, slippage);
        Log.module("swap").debug("Forward quote", quote);
        if (!quote) {
          setOutAmount(undefined);
          setNeedsApproval(true);
          setQuote(undefined);
          setReadyToSwap(false);

          return;
        }

        setReadyToSwap(true);
        setOutAmount(quote?.amount);
        if (quote.doApproval) {
          setNeedsApproval(true);
        } else {
          setNeedsApproval(false);
        }
        setQuote(quote);
        setHasEnoughBalance(await checkBalance(quoter!.fromToken, amount));
      } catch (err: unknown) {
        Log.module("swap").error("Error during quote: ", (err as Error).message);
        setOutAmount(undefined);
        setNeedsApproval(true);
        setQuote(undefined);
        setReadyToSwap(false);
      }
    },
    [account, checkBalance, outToken, quoter, slippage]
  );

  const handleOutputChange = useCallback(
    async (amount: TokenValue) => {
      setOutAmount(amount);
      setIsForwardQuote(false);
      if (amount.eq(0)) {
        setInAmount(inToken.amount(0));
        setQuote(undefined);
        return;
      }
      try {
        const quote = await quoter?.quoteReverse(amount, account!, slippage);
        Log.module("swap").debug("Reverse quote", quote);
        if (!quote) {
          setInAmount(undefined);
          setNeedsApproval(true);
          setQuote(undefined);
          setReadyToSwap(false);

          return;
        }

        setReadyToSwap(true);
        setInAmount(quote!.amount);
        if (quote?.doApproval) {
          setNeedsApproval(true);
        } else {
          setNeedsApproval(false);
        }
        setQuote(quote);
        setHasEnoughBalance(await checkBalance(quoter!.fromToken, quote.amountWithSlippage));
      } catch (err: unknown) {
        Log.module("swap").error("Error during quote: ", (err as Error).message);
        setInAmount(undefined);
        setReadyToSwap(false);
      }
    },
    [account, checkBalance, inToken, quoter, slippage]
  );

  const handleInputTokenChange = useCallback((token: Token) => {
    setInToken(token);
  }, []);
  const handleOutputTokenChange = useCallback((token: Token) => {
    setOutToken(token);
  }, []);

  const handleSlippageValueChange = useCallback(
    async (_slippage: string) => {
      setSlippage(Number(_slippage));
      if (isForwardQuote && inAmount) {
        const quote = await quoter?.quoteForward(inAmount, account!, Number(_slippage));
        if (quote) {
          setQuote(quote);
          setHasEnoughBalance(await checkBalance(quoter!.fromToken, quote.amountWithSlippage));
        }
      } else if (!isForwardQuote && outAmount) {
        const quote = await quoter?.quoteForward(outAmount, account!, Number(_slippage));
        if (quote) {
          setQuote(quote);
          setHasEnoughBalance(await checkBalance(quoter!.fromToken, quote.amountWithSlippage));
        }
      }
    },
    [isForwardQuote, inAmount, quoter, account, checkBalance, outAmount]
  );

  const approve = async () => {
    Log.module("swap").debug("Doing approval");
    if (!quote!.doApproval) throw new Error("quote.doApproval() is missing. Bad logic");

    setTxLoading(true);

    const toast = new TransactionToast({
      loading: "Waiting for approval",
      error: "Approval failed",
      success: "Approved"
    });

    try {
      const tx = await quote!.doApproval();
      toast.confirming(tx);

      const receipt = await tx.wait();

      let newQuote;
      if (isForwardQuote) {
        newQuote = await quoter?.quoteForward(inAmount!, account!, slippage);
      } else {
        newQuote = await quoter?.quoteReverse(outAmount!, account!, slippage);
      }

      setQuote(newQuote);
      if (!!newQuote?.doApproval) {
        setNeedsApproval(true);
        toast.error(new Error("Approval was not enough"));
      } else {
        toast.success(receipt);
        setNeedsApproval(false);
      }
    } catch (err) {
      Log.module("swap").error("Approval Failed", err);
      toast.error(err);
    } finally {
      setTxLoading(false);
    }
  };

  const swap = async () => {
    Log.module("swap").debug("Doing swap");
    setTxLoading(true);

    const toast = new TransactionToast({
      loading: "Confirming swap",
      error: "Swap failed",
      success: "Swap confirmed"
    });

    try {
      const tx = await quote!.doSwap();
      toast.confirming(tx);

      const receipt = await tx.wait();
      toast.success(receipt);

      setInAmount(undefined);
      setOutAmount(undefined);
      setNeedsApproval(true);
      setReadyToSwap(false);
      setQuote(undefined);
    } catch (err) {
      Log.module("swap").error("Swap Failed", err);
      toast.error(err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleButtonClick = async () => {
    if (!quote) throw new Error("Bad state, there is no quote. Button should've been disabled");
    try {
      if (needsApproval) {
        await approve();
      } else {
        await swap();
      }
    } catch (err) {
      Log.module("swap").error("Operation Failed", err);
    }
  };

  const getLabel = useCallback(() => {
    if (!account) return "Connect Wallet";
    if (!inAmount && !outAmount) return "Enter Amount";
    if (inAmount?.eq(TokenValue.ZERO) && outAmount?.eq(TokenValue.ZERO)) return "Enter Amount";
    if (!hasEnoughBalance) return "Insufficient Balance";
    if (needsApproval) return "Approve";

    return "Swap";
  }, [account, hasEnoughBalance, inAmount, needsApproval, outAmount]);

  if (Object.keys(tokens).length === 0)
    return <Container>There are no tokens. Please check you are connected to the right network.</Container>;

  return (
    <Container>
      <SwapInputContainer>
        <TokenInput
          id="input-amount"
          label={`Input amount in ${inToken.symbol}`}
          token={inToken}
          amount={inAmount}
          onAmountChange={handleInputChange}
          onTokenChange={handleInputTokenChange}
          canChangeToken={true}
          loading={isLoadingAllBalances}
        />
      </SwapInputContainer>
      <ArrowContainer>
        <ArrowButton onClick={arrowHandler} />
      </ArrowContainer>
      <SwapInputContainer>
        <TokenInput
          id="output-amount"
          label={`Output amount in ${inToken.symbol}`}
          token={outToken}
          amount={outAmount}
          onAmountChange={handleOutputChange}
          onTokenChange={handleOutputTokenChange}
          canChangeToken={true}
          showBalance={true}
          loading={isLoadingAllBalances}
        />
      </SwapInputContainer>
      <QuoteDetails
        type={isForwardQuote ? "FORWARD_SWAP" : "REVERSE_SWAP"}
        quote={{ quote: quote?.amount || TokenValue.ZERO, estimate: quote?.amountWithSlippage || TokenValue.ZERO, gas: quote?.gas }}
        inputs={[inAmount || TokenValue.ZERO, outAmount || TokenValue.ZERO]}
        handleSlippageValueChange={handleSlippageValueChange}
        wellTokens={[inToken, outToken]}
        slippage={slippage}
        tokenPrices={prices}
      />
      <SwapButtonContainer data-trace="true">
        <Button label={getLabel()} disabled={!buttonEnabled} onClick={handleButtonClick} loading={txLoading} />
      </SwapButtonContainer>
    </Container>
  );
};

const Container = styled.div`
  // border: 1px solid red;
  width: 384px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SwapInputContainer = styled.div`
  // outline: 1px dashed green;
  display: flex;
  flex-direction: row;
`;
const ArrowContainer = styled.div`
  // border: 1px dashed orange;
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const SwapButtonContainer = styled.div`
  // border: 1px dashed pink;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
