import tokenMetadataJson from 'src/token-metadata.json';
import { useQuery } from "@tanstack/react-query";
import { alchemy } from "../utils/alchemy";
import { TokenMetadataResponse } from "alchemy-sdk";

import { useTokens } from "src/tokens/useTokens";
import { useWells } from "src/wells/useWells";
import { getIsValidEthereumAddress } from "src/utils/addresses";
import { queryKeys } from "src/utils/query/queryKeys";
import { ERC20Token, Token } from "@beanstalk/sdk";
import { images } from "src/assets/images/tokens";
import { useMemo } from "react";
import { TokenMetadataMap } from 'src/types';

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

const metadataJson = tokenMetadataJson as TokenMetadataMap;

export const useTokenImage = (params: string | TokenIsh) => {
  const { data: wells } = useWells();
  const address = (params instanceof Token ? params.address : params || "").toLowerCase();
  const lpToken = wells?.find((well) => well.address.toLowerCase() === address)?.lpToken;

  const isValidAddress = getIsValidEthereumAddress(address);

  const existingImg = (() => {
    if (params instanceof Token) {
      const tokenSymbol = params.symbol;
      const tokenAddress = params.address;
      if (images[params.symbol]) return images[tokenSymbol];
      if (metadataJson[params.address]) return metadataJson[tokenAddress].logoURI;
    }
    return;
  })();

  const query = useQuery({
    queryKey: queryKeys.tokenMetadata(address || "invalid"),
    queryFn: async () => {
      const tokenMeta = await alchemy.core.getTokenMetadata(address ?? "");
      if (!tokenMeta) return { ...defaultMetas };
      return tokenMeta;
    },
    enabled: !!isValidAddress && !!params && !!wells?.length && !existingImg,
    retry: false,
    // We never need to refetch this data
    staleTime: Infinity
  });

  if (existingImg) return existingImg;
  if (query?.data?.logo) return query.data.logo;
  return lpToken ? images.LP : images.DEFAULT;  
}



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
    if (isValidAddress && existingToken) {
      if (existingToken.name) metas.name = existingToken.name;
      if (existingToken.decimals) metas.decimals = existingToken.decimals;
      if (existingToken.symbol) metas.symbol = existingToken.symbol;
      if (existingToken.logo && !existingToken.logo?.includes("DEFAULT.svg")) {
        metas.logo = existingToken.logo;
      };
    }
    
    return metas;
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
