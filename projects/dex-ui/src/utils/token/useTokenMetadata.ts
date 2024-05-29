import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ethers } from "ethers";
import { alchemy } from "../alchemy";
import { TokenMetadataResponse } from "alchemy-sdk";

import useSdk from "../sdk/useSdk";

export const useTokenMetadata = (_address: string | undefined): TokenMetadataResponse | undefined => {
  const address = _address?.toLowerCase() ?? "";

  const sdk = useSdk();

  const isValidAddress = Boolean(address && ethers.utils.isAddress(address));
  const sdkToken = sdk.tokens.findByAddress(address);

  console.log("_address: ", _address);

  const query = useQuery({
    queryKey: ["token-metadata", address],
    queryFn: async () => {
      const token = await alchemy.core.getTokenMetadata(address ?? "");
      console.debug("[useTokenMetadata]: ", address, token);
      return token;
    },
    enabled: !!address && isValidAddress && !sdkToken,
    // We never need to refetch this data
    staleTime: Infinity
  });

  console.log("query: ", query.data);

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
