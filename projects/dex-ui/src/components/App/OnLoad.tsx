import React, { useEffect } from "react";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { FC } from "src/types";
import { useAccount, useNetwork } from "wagmi";
import { watchNetwork } from "@wagmi/core";

export const OnLoad: FC<{}> = ({ children }) => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  
  // this call effectively acts as a 'prefetch' for the "get all token balances" query.
  // we also refetch it when network or account changes
  const { refetch } = useAllTokensBalance();

  useEffect(() => {
    refetch();
  }, [address, chain?.id, refetch]);

  useEffect(() => {
    const unwatch = watchNetwork((_network) => {
      location.reload();
    });

    return unwatch;
  });

  return <>{children}</>;
};
