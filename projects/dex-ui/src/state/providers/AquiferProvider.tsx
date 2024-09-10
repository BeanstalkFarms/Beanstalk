import React, { useEffect } from "react";

import { useAtom } from "jotai";
import { useChainId } from "wagmi";

import { ChainResolver } from "@beanstalk/sdk-core";
import { Aquifer } from "@beanstalk/sdk-wells";

import useSdk from "src/utils/sdk/useSdk";

import { aquiferAtom } from "../atoms";

const arbitrumAquiferAddress = import.meta.env.VITE_AQUIFER_ADDRESS_ARBITRUM as string;
const ethereumAquiferAddress = import.meta.env.VITE_AQUIFER_ADDRESS_ETH as string;

if (!arbitrumAquiferAddress) {
  throw new Error("Missing Arbitrum Aquifer addresses env var");
}

if (!ethereumAquiferAddress) {
  throw new Error("Missing Ethereum Aquifer addresses env var");
}

export const getAquiferAddress = (chainId: number) => {
  return ChainResolver.isL2Chain(chainId) ? arbitrumAquiferAddress : ethereumAquiferAddress;
};

const useSetAquifer = () => {
  const [aquifer, setAquifer] = useAtom(aquiferAtom);

  const sdk = useSdk();
  const chainId = useChainId();

  useEffect(() => {
    const aquiferAddress = getAquiferAddress(chainId);
    setAquifer(new Aquifer(sdk.wells, aquiferAddress));
  }, [sdk, chainId, setAquifer]);

  return aquifer;
};

const AquiferProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  const aquifer = useSetAquifer();

  if (!aquifer) return null;

  return <>{children}</>;
});

export default AquiferProvider;
