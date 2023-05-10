import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import { WellHistory } from "src/components/History/WellHistory";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { LiquidityRoot } from "src/components/Liquidity/LiquidityRoot";
import { Spinner } from "src/components/Spinner";
import { getPrice, usePrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { TokenValue } from "@beanstalk/sdk";

export const Well = () => {
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);
  const { isLoading: isAllTokenLoading, refetch: refetchBalances } = useAllTokensBalance();
  const [isLoadingAllBalances, setIsLoadingAllBalances] = useState(true);
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);
  const sdk = useSdk();

  useEffect(() => {
    const run = async () => {
      if (!well?.tokens) return;

      const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
      setPrices(prices);
    };

    run();
  }, [sdk, well?.tokens]);

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

  const reserves = (well.reserves ?? []).map((amount, i) => {
    const token = well.tokens?.[i];
    const price = prices[i];

    return {
      token,
      amount,
      dollarAmount: price ? amount.mul(price) : null
    };
  });

  return (
    <div>
      <strong>{well.name}</strong>
      <br />
      <strong>Tokens:</strong> {well.tokens?.map((t) => t.symbol).join(":")}
      <br />
      <strong>Reserves: </strong>
      {(reserves ?? []).map((r) => (
        <div key={r.token?.symbol}>
          {r.amount.toHuman("0.0a")} {r.token!.symbol} - ${r.dollarAmount?.toHuman("0.0a") ?? ""} USD
        </div>
      ))}
      <br />
      <br />
      <div>{isLoadingAllBalances ? <Spinner size={50} /> : <LiquidityRoot well={well} txnCompleteCallback={liquidityTxnCallback} />}</div>
      <div>
        <WellHistory well={well} />
      </div>
    </div>
  );
};
