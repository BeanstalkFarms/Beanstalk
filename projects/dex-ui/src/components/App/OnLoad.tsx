import React, { useEffect } from "react";
import { useTokenBalance } from "src/tokens/useTokenBalance";
import { FC } from "src/types";
import { useAccount, useNetwork } from "wagmi";

export const OnLoad: FC<{}> = ({ children }) => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const { isLoading, refetch } = useTokenBalance();

  useEffect(() => {
    refetch();
  }, [address, chain?.id, refetch]);
  if (isLoading) return <>loading..</>;

  return <>{children}</>;
};
