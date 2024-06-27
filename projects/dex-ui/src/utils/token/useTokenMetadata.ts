import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ethers } from "ethers";
import { alchemy } from "../alchemy";
import { TokenMetadataResponse } from "alchemy-sdk";

import useSdk from "../sdk/useSdk";
import { useTokens } from "src/tokens/TokenProvider";
import { useWells } from "src/wells/useWells";

export const useTokenMetadata = (
  _address: string | undefined
): TokenMetadataResponse | undefined => {
  const address = _address?.toLowerCase() ?? "";
  const sdk = useSdk();

  const isValidAddress = Boolean(address && ethers.utils.isAddress(address));
  const { data: wells } = useWells();
  const tokens = useTokens();

  const wellToken = useMemo(() => {
    return Object.values(tokens).find((t) => t.address.toLowerCase() === address.toLowerCase());
  }, [tokens, address]);

  const sdkToken = useMemo(() => {
    return sdk.tokens.findByAddress(address);
  }, [sdk, address]);

  const well = wells?.find((well) => well.address.toLowerCase() === address.toLowerCase());

  const tokenDataKnown = Boolean(well || wellToken || sdkToken);

  const query = useQuery({
    queryKey: ["token-metadata", address],
    queryFn: async () => {
      const token = await alchemy.core.getTokenMetadata(address ?? "");
      return token;
    },
    enabled: !!address && isValidAddress && !tokenDataKnown && !!wells?.length,
    // We never need to refetch this data
    staleTime: Infinity
  });

  return useMemo(() => {
    let metadata: TokenMetadataResponse = {
      decimals: wellToken?.decimals ?? sdkToken?.decimals ?? null,
      logo: wellToken?.logo ?? sdkToken?.logo ?? null,
      name: wellToken?.name ?? sdkToken?.name ?? null,
      symbol: wellToken?.symbol ?? sdkToken?.symbol ?? null
    };

    if (wellToken || sdkToken) return metadata;

    return query.data;
  }, [query.data, sdkToken, wellToken]);
};
