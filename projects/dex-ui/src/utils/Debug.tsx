import { useChains } from "connectkit";
import React from "react";
import { useAccount } from "wagmi";

export const Debug = () => {
  const account = useAccount();
  const chains = useChains();
  console.log("DEBUG:");
  console.log(account);
  console.log(chains);

  return (
    <div>
      <pre>{`
${account.address}
${account.connector?.name}
${account.status}
`}</pre>
    </div>
  );
};
