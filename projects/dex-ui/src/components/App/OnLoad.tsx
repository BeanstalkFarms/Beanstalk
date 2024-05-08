import React, { useEffect } from "react";
import { useAllTokensBalance } from "src/tokens/useAllTokenBalance";
import { FC } from "src/types";
import { useAccount } from "wagmi";

export const OnLoad: FC<{}> = ({ children }) => {
  const { address, chain } = useAccount();
  // this call effectively acts as a 'prefetch' for the "get all token balances" query.
  // we also refetch it when network or account changes
  const { refetch } = useAllTokensBalance();

  useEffect(() => {
    refetch();
  }, [address, chain?.id, refetch]);

  // useEffect(() => {
  //   const unwatch = watchAccount(config, {
  //     onChange(account, prevAccount) {
  //       // if (account.chain?.id !== chain?.id) {
  //       //   console.log("CHECK ME");
  //       // }
  //       // if (prevAccount.address !== account.address) {
  //       //   console.log(`CHANGED! - from(${prevAccount.address}) to => ${account.address}`);
  //       // }
  //     }
  //   });

  //   return () => unwatch();
  // });

  return <>{children}</>;
};
