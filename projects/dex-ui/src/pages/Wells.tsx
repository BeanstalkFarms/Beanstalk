import { Well } from "@beanstalk/sdk/Wells";
import React from "react";
import { Link } from "react-router-dom";
import { useWells } from "src/wells/useWells";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  if (isLoading) return <div>loading...</div>;
  if (error) return <div>{error.message}</div>;

  const rows = wells?.map((well) => (
    <div key={well.address}>
      <Link to={`/wells/${well.address}`}>{well.name}</Link>
    </div>
  ));

  return (
    <div>
      <strong>Wells:</strong>
      <div>{rows}</div>
    </div>
  );
};
