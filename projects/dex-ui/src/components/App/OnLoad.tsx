import React, { useEffect } from "react";
import { useAllTokensBalance } from "src/tokens/useTokenBalance";
import { FC } from "src/types";
import { useAccount, useNetwork } from "wagmi";

export const OnLoad: FC<{}> = ({ children }) => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  // this call effectively acts as a 'prefetch' for the "get all token balances" query.
  // we also refetch it when network or account changes
  const { refetch } = useAllTokensBalance();

  useEffect(() => {
    refetch();
  }, [address, chain?.id, refetch]);

  return <>{children}</>;
};
