import { Token, TokenValue } from "@beanstalk/sdk";
import React, { useCallback, useEffect, useState } from "react";
import { useTokens } from "src/tokens/TokenProvider";
import styled from "styled-components";
import { ArrowButton } from "./ArrowButton";
import gear from "src/assets/images/gear.svg";
import { TokenInput } from "./TokenInput";
import { Image } from "../Image";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { useSwapBuilder } from "./useSwapBuilder";
import { useAccount } from "wagmi";
import { Quote, QuoteResult } from "@beanstalk/sdk/Wells";
import { Button } from "./Button";

export const SwapRoot = () => {
  const { address: account } = useAccount();

  const tokens = useTokens();
  const [inAmount, setInAmount] = useState<TokenValue>();
  const [inToken, setInToken] = useState<Token>(tokens["WETH"]);
  const [outToken, setOutToken] = useState<Token>(tokens["BEAN"]);
  const [outAmount, setOutAmount] = useState<TokenValue>();
  const [slippage, setSlippage] = useState<number>(0.1);
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);
  const { isLoading: isAllTokenLoading } = useAllTokensBalance();
  const [quoter, setQuoter] = useState<Quote | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [readyToSwap, setReadyToSwap] = useState(false);
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [txLoading, setTxLoading] = useState(false);

  const [quote, setQuote] = useState<QuoteResult | undefined>();
  const builder = useSwapBuilder();

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
    readyToSwap && !!account ? setButtonEnabled(true) : setButtonEnabled(false);
    console.log("Button Enable: ", readyToSwap, !!account);
  }, [readyToSwap, account]);

  const arrowHandler = () => {
    const prevInToken = inToken;
    const prevInAmount = inAmount;

    setInToken(outToken);
    setInAmount(outAmount);
    setOutToken(prevInToken);
    setOutAmount(prevInAmount);
  };

  const handleInputChange = useCallback(
    async (a: TokenValue) => {
      setInAmount(a);
      if (a.eq(0)) {
        setOutAmount(outToken.amount(0));
        return;
      }

      try {
        const quote = await quoter?.quoteForward(a, account!, slippage);
        if (!quote) {
          setOutAmount(undefined);
          setNeedsApproval(true);
          setQuote(undefined);
          setReadyToSwap(false);
        }
        setReadyToSwap(true);
        setOutAmount(quote?.amount);
        if (quote?.doApproval) {
          setNeedsApproval(true);
        } else {
          setNeedsApproval(false);
        }
        setQuote(quote);
      } catch (err: unknown) {
        console.error("Error during quote: ", (err as Error).message);
        setOutAmount(undefined); // TODO: clear this better
        setReadyToSwap(false);
      }
    },
    [account, outToken, quoter, slippage]
  );

  const handleOutputChange = useCallback(
    async (a: TokenValue) => {
      setOutAmount(a);
      if (a.eq(0)) {
        setInAmount(inToken.amount(0));
        return;
      }
      try {
        const quote = await quoter?.quoteReverse(a, account!, slippage);
        setInAmount(quote!.amount);
      } catch (err: unknown) {
        console.error("Error during quote: ", (err as Error).message);
        setInAmount(undefined); // TODO: clear this better
        setReadyToSwap(false);
      }
    },
    [account, inToken, quoter, slippage]
  );

  const handleInputTokenChange = useCallback((token: Token) => {
    setInToken(token);
  }, []);
  const handleOutputTokenChange = useCallback((token: Token) => {
    setOutToken(token);
  }, []);

  const handleSwapClick = async () => {
    if (!quote) throw new Error("Bad state, quote there is no quote. Button should've been disabled");
    setTxLoading(true);
    try {
      if (needsApproval) {
        console.log("Doing approval");
        if (!quote.doApproval) throw new Error("quote.doApproval() is missing. Bad logic");
        const tx = await quote.doApproval();
        await tx.wait();

        setNeedsApproval(false);
      } else {
        console.log("Doing swap");
        const tx = await quote.doSwap();
        await tx.wait();
        setNeedsApproval(true);
        setReadyToSwap(false);
        setQuote(undefined);
      }
    } catch (err) {
      
    }
    setTxLoading(false);
  };

  const getLabel = useCallback(() => {
    if (!account) return "Connect Wallet";
    if (!inAmount && !outAmount) return "Enter Amount";
    if (needsApproval) return "Approve";

    return "Swap";
  }, [account, inAmount, needsApproval, outAmount]);

  // console.log(` ${inAmount?.toHuman()} ${inToken?.symbol} => ${outAmount?.toHuman()} ${outToken?.symbol}`);

  return (
    <Container>
      <SwapHeaderContainer>
        <div>Swap</div>
        <div>
          <Image src={gear} size={16} alt="Transaction Settings" />
        </div>
      </SwapHeaderContainer>
      <Div>
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
            showMax={false}
            loading={isLoadingAllBalances}
          />
        </SwapInputContainer>
      </Div>
      <SwapDetailsContainer>Details</SwapDetailsContainer>
      <SwapButtonContainer>
        <Button label={getLabel()} disabled={!buttonEnabled} onClick={handleSwapClick} loading={txLoading} />
      </SwapButtonContainer>
    </Container>
  );
};

const Container = styled.div`
  width: 465px;
  display: flex;
  flex-direction: column;
  background: #1b1e2b;
  border-radius: 16px;
  padding: 12px;
  gap: 12px;
`;

const Div = styled.div`
  display: flex;
  flex-direction: column;
`;

const SwapHeaderContainer = styled.div`
  // border: 1px dotted blue;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px 12px;
  height: 36px;
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
  align-items: center;
`;

const SwapInputContainer = styled.div`
  // border: 1px dashed green;
  display: flex;
  flex-direction: row;
  margin: 2.5px 0px;
`;
const ArrowContainer = styled.div`
  // border: 1px dashed orange;
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const SwapDetailsContainer = styled.div`
  // border: 1px dashed pink;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const SwapButtonContainer = styled.div`
  // border: 1px dashed pink;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
