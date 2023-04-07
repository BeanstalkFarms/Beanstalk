import React from "react";
import { useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import useWellSwaps from "src/wells/useWellSwaps";

export const Well = () => {
  const { address } = useParams<"address">();
  const { well, loading, error } = useWell(address!);

  const { swaps, loading: swapsLoading, error: swapsError } = useWellSwaps(address!);

  if (loading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  console.log("Well: ", address);
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
      <div>
        <h1>Swaps history</h1>
        {swaps.map((swap) => (
          <>
            <strong>swap: {swap.hash}</strong> {swap.tokenOut.name}
            <br />
          </>
        ))}
      </div>
    </div>
  );
};
