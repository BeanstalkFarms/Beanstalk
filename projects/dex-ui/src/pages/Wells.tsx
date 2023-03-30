import React from "react";
import { Link } from "react-router-dom";
import { useWells } from "src/wells/useWells";

export const Wells = () => {
  const { wells, loading, error } = useWells();
  if (loading) return <div>loading...</div>;
  if (error) return <div>{error}</div>;

  const rows = wells?.map((well) => <div key={well.address}><Link to={`/wells/${well.address}`}>{well.name}</Link></div>);

  return (
    <div>
      <strong>Wells:</strong>
      <div>{rows}</div>
    </div>
  );
};
