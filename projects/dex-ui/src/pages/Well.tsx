import React from "react";
import { useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import { AddLiquidity } from "src/components/Liquidity/AddLiquidity";
import { WellHistory } from "src/components/History/WellHistory";
import { RemoveLiquidity } from "src/components/Liquidity/RemoveLiquidity";

export const Well = () => {
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);

  if (loading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  console.log("Well: ", wellAddress);
  if (!well) return null;

  return (
    <div>
      <strong>Name: {well.name}</strong>
      <br />
      <strong>Tokens: {well.tokens?.map((t) => t.symbol).join(":")}</strong>
      <br />
      <strong>Reserves: {well.reserves?.map((r) => r.toHuman()).join(":")}</strong>
      <br />
      <div>
        <AddLiquidity well={well} />
      </div>
      <div>
        <RemoveLiquidity well={well} />
      </div>
      <div>
        <WellHistory well={well} />
      </div>
    </div>
  );
};
