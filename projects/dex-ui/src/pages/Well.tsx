import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";

export const Well = () => {
  const { address } = useParams<"address">();
  const { well, loading, error } = useWell(address!);

  if (loading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  console.log("Well: ", address);
  if (!well) return null;

  return (
    <div>
      <strong>Name: {well.name}</strong>
      <br />
      <strong>Tokens: {well.tokens!.map((t) => t.symbol).join(":")}</strong>
      <br />
      <strong>Reserves: {well.reserves!.map((r) => r.toHuman()).join(":")}</strong>
    </div>
  );
};
