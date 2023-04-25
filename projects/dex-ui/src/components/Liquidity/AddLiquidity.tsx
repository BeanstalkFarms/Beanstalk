import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { Token, TokenValue } from "@beanstalk/sdk";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import styled from "styled-components";
import { images } from "src/assets/images/tokens";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";

type LiquidityAmounts = {
  [key: number]: TokenValue;
};

type AddLiquidityProps = {
  well: Well;
};

export const AddLiquidity = ({ well }: AddLiquidityProps) => {
  const { address } = useAccount();
  const [wellTokens, setWellTokens] = useState<Token[]>([]);
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const [receipt, setReceipt] = useState<ContractReceipt | null>(null);
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);

  const { isLoading: isAllTokenLoading, refetch: refetchBalances } = useAllTokensBalance();

  const atLeastOneAmountNonzero = useCallback(() => Object.values(amounts).filter((amount) => amount.value.gt("0")).length > 0, [amounts]);

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

      setWellTokens(tokens);
      setAmounts(initialAmounts);
    }
  }, [well]);

  const {
    data: quote,
    isLoading: loadingQuote,
    isError: quoteError
  } = useQuery(["wells", address, amounts], async () => {
    if (!atLeastOneAmountNonzero()) {
      return null;
    }
    return well.addLiquidityQuote(Object.values(amounts));
  });

  const addLiquidityButtonClickHandler = useCallback(async () => {
    if (quote && address) {
      const addLiquidityTxn = await well.addLiquidity(Object.values(amounts), quote, address);
      const receipt = await addLiquidityTxn.wait();
      setReceipt(receipt);
      refetchBalances();
    }
  }, [well.addLiquidity, amounts, quote, address]);

  const handleInputChange = useCallback(
    (index: number) => (a: TokenValue) => {
      setAmounts({ ...amounts, [index]: a });
    },
    [amounts]
  );

  const addLiquidityButtonEnabled = useMemo(() => address && atLeastOneAmountNonzero(), [address, atLeastOneAmountNonzero]);

  return (
    <div>
      {wellTokens.length > 0 && (
        <div>
          <h1>Add Liquidity</h1>
          <div>
            <TokenListContainer>
              {well.tokens?.map((token, index) => (
                <TokenInput
                  id={`input${index}`}
                  label={`Input amount in ${token.symbol}`}
                  token={wellTokens[index]}
                  amount={amounts[index]}
                  onAmountChange={handleInputChange(index)}
                  canChangeToken={false}
                  loading={isLoadingAllBalances}
                />
              ))}
            </TokenListContainer>
            {loadingQuote && <h2>Loading Quote...</h2>}
            {!loadingQuote && quote && <h2>lpAmountOut: {quote.toHuman()}</h2>}
            {quoteError && <h2>Error loading quote</h2>}
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
