import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import { WellHistory } from "src/components/History/WellHistory";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { LiquidityRoot } from "src/components/Liquidity/LiquidityRoot";
import { Spinner } from "src/components/Spinner";

export const Well = () => {
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);
  const { isLoading: isAllTokenLoading, refetch: refetchBalances } = useAllTokensBalance();
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);

  useEffect(() => {
    const fetching = isAllTokenLoading;
    fetching ? setIsLoadingAllBalances(true) : setTimeout(() => setIsLoadingAllBalances(false), 500);
  }, [isAllTokenLoading]);

  const liquidityTxnCallback = useCallback(() => {
    refetchBalances();
  }, [refetchBalances]);

  if (loading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  if (!well) return null;

  return (
    <div>
      <strong>{well.name}</strong>
      <br />
      <strong>Tokens:</strong> {well.tokens?.map((t) => t.symbol).join(":")}
      <br />
      <strong>Reserves: </strong>
      {well.reserves?.map((r, i) => `${r.toHuman("0,0.00a")} ${well.tokens?.[i].symbol}`).join(" - ")}
      <br />
      <br />
      <div>{isLoadingAllBalances ? <Spinner size={50} /> : <LiquidityRoot well={well} txnCompleteCallback={liquidityTxnCallback} />}</div>
      <div>
        <WellHistory well={well} />
      </div>
    </div>
  );
};
