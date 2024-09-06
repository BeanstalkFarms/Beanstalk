import React, { useMemo } from "react";
import { useAtom } from "jotai";
import useSdk from "src/utils/sdk/useSdk";
import { useChainId } from "wagmi";
import { aquiferAtom } from "../atoms";
import { isArbitrum } from "src/utils/chain";
import { Aquifer } from "@beanstalk/sdk-wells";

const arbitrumAquiferAddress = import.meta.env.VITE_AQUIFER_ADDRESS_ARBITRUM as string;
const ethereumAquiferAddress = import.meta.env.VITE_AQUIFER_ADDRESS_ETH as string;

if (!arbitrumAquiferAddress) {
  throw new Error("Missing Arbitrum Aquifer addresses env var");
}

if (!ethereumAquiferAddress) {
  throw new Error("Missing Ethereum Aquifer addresses env var");
}

export const getAquiferAddress = (chainId: number) => {
  return isArbitrum(chainId) ? arbitrumAquiferAddress : ethereumAquiferAddress;
};

const useSetAquifer = () => {
  const [aquifer, setAquifer] = useAtom(aquiferAtom);

  const sdk = useSdk();
  const chainId = useChainId();

  React.useEffect(() => {
    const aquiferAddress = isArbitrum(chainId) ? arbitrumAquiferAddress : ethereumAquiferAddress;
    setAquifer(new Aquifer(sdk.wells, aquiferAddress));
  }, [sdk, chainId, setAquifer]);

  return useMemo(() => aquifer, [aquifer]);
};

const AquiferProvider = ({ children }: { children: React.ReactNode }) => {
  const aquifer = useSetAquifer();

  if (!aquifer) return null;

  return <>{children}</>;
};

export default AquiferProvider;
