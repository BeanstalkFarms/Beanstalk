import { useQuery } from "@tanstack/react-query";
import { alchemy } from "../utils/alchemy";
import { TokenMetadataResponse } from "alchemy-sdk";

import { useTokens } from "src/tokens/TokenProvider";
import { useWells } from "src/wells/useWells";
import { getIsValidEthereumAddress } from "src/utils/addresses";
import { queryKeys } from "src/utils/query/queryKeys";
import { ERC20Token, Token } from "@beanstalk/sdk";
import { images } from "src/assets/images/tokens";
import { useEffect, useMemo } from "react";

const emptyMetas: TokenMetadataResponse = {
  decimals: null,
  logo: null,
  name: null,
  symbol: null
};

const defaultMetas: TokenMetadataResponse = {
  name: "UNKNOWN",
  symbol: "UNKNOWN",
  logo: images.DEFAULT,
  decimals: null
};

type TokenIsh = Token | ERC20Token | undefined;

export const useTokenMetadata = (params: string | TokenIsh): TokenMetadataResponse | undefined => {
  const address = (params instanceof Token ? params.address : params || "").toLowerCase();

  const isValidAddress = getIsValidEthereumAddress(address);
  const { data: wells } = useWells();
  const tokens = useTokens();

  const wellPairToken = Object.values(tokens).find((t) => t.address.toLowerCase() === address);
  const lpToken = wells?.find((well) => well.address.toLowerCase() === address)?.lpToken;
  const existingToken = wellPairToken || lpToken;

  const existingMetas = useMemo(() => {
    const metas = { ...emptyMetas };
    if (!isValidAddress || !existingToken) return metas;

    return {
      name: existingToken.name,
      symbol: existingToken.symbol,
      logo: existingToken.logo?.includes("DEFAULT.svg") ? null : existingToken.logo,
      decimals: existingToken.decimals
    } as TokenMetadataResponse;
  }, [isValidAddress, existingToken]);

  const metaValues = Object.values(existingMetas);
  const hasAllMetas = metaValues.length && metaValues.every(Boolean);

  const query = useQuery({
    queryKey: queryKeys.tokenMetadata(address || "invalid"),
    queryFn: async () => {
      if (!wells?.length) return;

      let metas = { ...existingMetas };
      const tokenMeta = await alchemy.core.getTokenMetadata(address ?? "");
      if (!tokenMeta) return { ...defaultMetas };

      metas = mergeMetas(tokenMeta, metas);

      return metas;
    },
    enabled: isValidAddress && !!wells?.length && !hasAllMetas,
    retry: false,
    // We never need to refetch this data
    staleTime: Infinity
  });

  useEffect(() => {
    if (existingMetas.symbol?.toLowerCase() === "wsteth") {
      console.log("existing metas: ", existingMetas);
      console.log("query data: ", query.data);
    }
  }, [existingMetas, query])

  const metadatas = useMemo(() => {
    const meta: TokenMetadataResponse = {
      name: existingMetas?.name ?? query.data?.name ?? null,
      symbol: existingMetas?.symbol ?? query.data?.symbol ?? null,
      logo: existingMetas?.logo ?? query.data?.logo ?? null,
      decimals: existingMetas?.decimals ?? query.data?.decimals ?? null
    };

    return meta;
  }, [existingMetas, query.data]);

  return metadatas;
};

const mergeMetas = (
  data: Token | TokenMetadataResponse | undefined,
  meta: TokenMetadataResponse
) => {
  if (!data) return meta;
  if (!meta.decimals && data?.decimals) meta.decimals = data.decimals;
  if (!meta.symbol && data?.symbol) meta.symbol = data.symbol;
  if (!meta.name && data?.name) meta.name = data.name;
  if (!meta.logo && data?.logo) meta.logo = data.logo;
  return meta;
};
