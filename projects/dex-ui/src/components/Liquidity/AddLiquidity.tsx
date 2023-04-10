import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import { useAllTokensBalance } from "src/tokens/useTokenBalance";
import styled from "styled-components";
import { images } from "src/assets/images/tokens";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";

type LiquidityAmounts = {
  [key: number]: TokenValue;
};

type AddLiquidityProps = {
  well: Well;
};

export const AddLiquidity = ({ well }: AddLiquidityProps) => {
  const { address } = useAccount();
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [liquidityTokens, setLiquidityTokens] = useState<Token[]>([]);
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const [receipt, setReceipt] = useState<ContractReceipt | null>(null);
  const [quote, setQuote] = useState<TokenValue | null>(null);
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);

  const { isLoading: isAllTokenLoading, refetch: refetchBalances } = useAllTokensBalance();

  const atLeastOneAmountNonzero = () => Object.values(amounts).filter((amount) => amount.value.gt("0")).length > 0;

  useEffect(() => {
    const fetching = isAllTokenLoading;
    fetching ? setIsLoadingAllBalances(true) : setTimeout(() => setIsLoadingAllBalances(false), 500);
  }, [isAllTokenLoading]);

  useEffect(() => {
    if (well.tokens) {
      const tokens: Token[] = [];
      const initialAmounts: LiquidityAmounts = {};
      well.tokens.forEach((token, index) => {
        token.setMetadata({ logo: images[token.symbol] ?? images.DEFAULT });
        tokens.push(token);
        initialAmounts[index] = TokenValue.ZERO;
      });

      setLiquidityTokens(tokens);
      setAmounts(initialAmounts);
    }
  }, [well]);

  const fetchQuote = async () => {
    const quote = await well.addLiquidityQuote(Object.values(amounts));
    // TODO: Temporary to show the loading effect
    await new Promise((r) => setTimeout(r, 200));
    setQuote(quote);
    setLoadingQuote(false);
  };

  useEffect(() => {
    // TODO: Debounce and/or cancel somehow
    console.log(">>> Amounts changed...");
    console.log(amounts);
    if (atLeastOneAmountNonzero()) {
      setLoadingQuote(true);
      fetchQuote();
    } else {
      setQuote(null);
    }
  }, [amounts]);

  const addLiquidityButtonClickHandler = async () => {
    if (quote && address) {
      const addLiquidityTxn = await well.addLiquidity(Object.values(amounts), quote, address);
      const receipt = await addLiquidityTxn.wait();
      setReceipt(receipt);
      setQuote(null);
      refetchBalances();
    }
  };

  const handleInputChange = (index: number) => {
    return (a: TokenValue) => {
      setAmounts({ ...amounts, [index]: a });
    };
  };

  const addLiquidityButtonEnabled = address && atLeastOneAmountNonzero();

  return (
    <div>
      {liquidityTokens.length > 0 && (
        <div>
          <h1>Add Liquidity</h1>
          <div>
            <TokenListContainer>
              {well.tokens?.map((token, index) => (
                <TokenInput
                  id={`input${index}`}
                  label={`Input amount in ${token.symbol}`}
                  token={liquidityTokens[index]}
                  amount={amounts[index]}
                  onAmountChange={handleInputChange(index)}
                  canChangeToken={false}
                  loading={isLoadingAllBalances}
                />
              ))}
            </TokenListContainer>
            {loadingQuote && <h2>Loading Quote...</h2>}
            {!loadingQuote && quote && <h2>lpAmountOut: {quote.toHuman()}</h2>}
            {receipt && <h2>{`txn hash: ${receipt.transactionHash.substring(0, 6)}...`}</h2>}
            {addLiquidityButtonEnabled && <button onClick={addLiquidityButtonClickHandler}>Add Liquidity</button>}
          </div>
        </div>
      )}
    </div>
  );
};

const TokenListContainer = styled.div`
  width: 465px;
  display: flex;
  flex-direction: column;
  background: #1b1e2b;
  border-radius: 16px;
  padding: 12px;
  gap: 12px;
`;
