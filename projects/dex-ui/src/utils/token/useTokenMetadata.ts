import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ethers } from "ethers";
import { alchemy } from "../alchemy";
import { TokenMetadataResponse } from "alchemy-sdk";

import useSdk from "../sdk/useSdk";
import BeanLogo from "src/assets/images/tokens/BEAN.svg";
import usdtLogo from "src/assets/images/tokens/USDT.svg";
import usdcLogo from "src/assets/images/tokens/USDC.svg";
import daiLogo from "src/assets/images/tokens/DAI.svg";
import wethLogo from "src/assets/images/tokens/WETH.svg";
import ethLogo from "src/assets/images/tokens/ETH.svg";

const useSetSdkTokenMetadata = () => {
  const sdk = useSdk();

  useEffect(() => {
    const tokens = sdk.tokens;

    if (!tokens.BEAN.logo) tokens.BEAN.setMetadata({ logo: BeanLogo });
    if (!tokens.USDT.logo) tokens.USDT.setMetadata({ logo: usdtLogo });
    if (!tokens.USDC.logo) tokens.USDC.setMetadata({ logo: usdcLogo });
    if (!tokens.DAI.logo) tokens.DAI.setMetadata({ logo: daiLogo });
    if (!tokens.WETH.logo) tokens.WETH.setMetadata({ logo: wethLogo });
    if (!tokens.ETH.logo) tokens.ETH.setMetadata({ logo: ethLogo });
  }, [sdk]);
};

export const useTokenMetadata = (address: string): TokenMetadataResponse | undefined => {
  useSetSdkTokenMetadata();

  const sdk = useSdk();

  const isValidAddress = Boolean(address && ethers.utils.isAddress(address));
  const sdkToken = sdk.tokens.findByAddress(address.toLowerCase());

  const query = useQuery({
    queryKey: ["token-metadata", address],
    queryFn: async () => {
      const token = await alchemy.core.getTokenMetadata(address);
      console.debug("[useTokenMetadata]: ", address, token);
      return token;
    },
    enabled: isValidAddress && !sdkToken,
    // We never need to refetch this data
    staleTime: Infinity
  });

  return useMemo(() => {
    let metadata: TokenMetadataResponse = {
      decimals: sdkToken?.decimals ?? null,
      logo: sdkToken?.logo ?? null,
      name: sdkToken?.name ?? null,
      symbol: sdkToken?.symbol ?? null
    };

    if (sdkToken) return metadata;

    return query.data;
  }, [query.data, sdkToken]);
};
