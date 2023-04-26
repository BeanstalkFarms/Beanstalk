import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TokenInput } from "src/components/Swap/TokenInput";
import { TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { useAccount } from "wagmi";
import { ContractReceipt } from "ethers";
import { Well } from "@beanstalk/sdk/Wells";
import { useQuery } from "@tanstack/react-query";
import { LiquidityAmounts } from "./types";

type AddLiquidityProps = {
  well: Well;
  txnCompleteCallback: () => void;
};

export const AddLiquidity = ({ well, txnCompleteCallback }: AddLiquidityProps) => {
  const { address } = useAccount();
  const [amounts, setAmounts] = useState<LiquidityAmounts>({});
  const [receipt, setReceipt] = useState<ContractReceipt | null>(null);

  const atLeastOneAmountNonzero = useCallback(() => Object.values(amounts).filter((amount) => amount.value.gt("0")).length > 0, [amounts]);

  useEffect(() => {
    if (well.tokens) {
      const initialAmounts: LiquidityAmounts = {};
      for (let i = 0; i < well.tokens.length; i++) {
        initialAmounts[i] = TokenValue.ZERO;
      }

      setAmounts(initialAmounts);
    }
  }, [well.tokens]);

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
      txnCompleteCallback();
    }
  }, [quote, address, well, amounts, refetchBalances]);

  const handleInputChange = useCallback(
    (index: number) => (a: TokenValue) => {
      setAmounts({ ...amounts, [index]: a });
    },
    [amounts]
  );

  const addLiquidityButtonEnabled = useMemo(() => address && atLeastOneAmountNonzero(), [address, atLeastOneAmountNonzero]);

  return (
    <div>
      {well.tokens!.length > 0 && (
        <div>
          <h1>Add Liquidity</h1>
          <div>
            <TokenListContainer>
              {well.tokens?.map((token, index) => (
                <TokenInput
                  key={index}
                  id={`input${index}`}
                  label={`Input amount in ${token.symbol}`}
                  token={well.tokens![index]}
                  amount={amounts[index]}
                  onAmountChange={handleInputChange(index)}
                  canChangeToken={false}
                  loading={false}
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
