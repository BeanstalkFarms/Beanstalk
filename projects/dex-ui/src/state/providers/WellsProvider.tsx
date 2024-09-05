import React, { useEffect } from "react";
import useSdk from "src/utils/sdk/useSdk";
import { Well } from "@beanstalk/sdk/Wells";
import { findWells } from "src/wells/wellLoader";
import { Log } from "src/utils/logger";
import tokenMetadataJson from "src/token-metadata.json";
import { TokenMetadataMap, TokenSymbolMap } from "src/types";
import { images } from "src/assets/images/tokens";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import { useSetAtom } from "jotai";
import { setWellsLoadingAtom, wellsAtom } from "../atoms/wells.atoms";
import { queryKeys } from "src/utils/query/queryKeys";
import { Error } from "src/components/Error";
import { Token } from "@beanstalk/sdk-core";
import { underlyingTokenMapAtom } from "../atoms/tokens.atoms";
import { useChainId } from "wagmi";
import { getTokenIndex } from "src/tokens/utils";

export const clearWellsCache = () => findWells.cache.clear?.();

export const useWellsQuery = () => {
  const sdk = useSdk();
  const chainId = useChainId();
  const setWells = useSetAtom(wellsAtom);
  const setTokenMap = useSetAtom(underlyingTokenMapAtom);
  const setWellsLoading = useSetAtom(setWellsLoadingAtom);

  useEffect(() => {
    // clearWellsCache();
  }, [chainId]);

  return useChainScopedQuery({
    queryKey: queryKeys.wells,
    queryFn: async () => {
      try {
        setWellsLoading(true);
        const wellAddresses = await findWells(sdk);
        Log.module("wells").debug("Well addresses: ", wellAddresses);

        // TODO: convert this to a multicall at some point
        const res = await Promise.allSettled(
          wellAddresses.map((address) =>
            sdk.wells
              .getWell(address, {
                name: true,
                tokens: true,
                wellFunction: true,
                pumps: true,
                reserves: true,
                lpToken: true
              })
              .catch((err) => {
                Log.module("wells").log(`Failed to load Well [${address}]: ${err.message}`);
              })
          )
        );

        // filter out errored calls
        const wellsResult = res
          .map((promise) => (promise.status === "fulfilled" ? promise.value : null))
          .filter<Well>((p): p is Well => !!p);
        // set token metadatas
        setTokenMetadatas(wellsResult);
        setWells({ data: wellsResult, error: null, isLoading: false });

        if (wellsResult.length) {
          const tokenMap = (wellsResult || []).reduce<TokenSymbolMap<Token>>((prev, well) => {
            if (well.tokens && Array.isArray(well.tokens)) {
              well.tokens.forEach((token) => {
                prev[token.symbol] = token;
              });
            }
            return prev;
          }, {
            [getTokenIndex(sdk.tokens.ETH)]: sdk.tokens.ETH
          });

          setTokenMap(tokenMap);
        }


        return wellsResult;
      } catch (err: any) {
        Log.module("useWells").debug(`Error during findWells(): ${(err as Error).message}`);
        setWells({ data: [], error: err, isLoading: false });
        return [];
      }
    },
    retry: false,
    staleTime: Infinity
  });
};

const WellsProvider = ({ children }: { children: React.ReactNode }) => {
  const { error } = useWellsQuery();

  if (error) {
    return <Error message={error.message} />;
  }

  return <>{children}</>;
};

const tokenMetadata = tokenMetadataJson as TokenMetadataMap;

const setTokenMetadatas = (wells: Well[]) => {
  for (const well of wells) {
    if (!well.tokens) continue;
    if (well.lpToken) {
      const lpLogo = images[well.lpToken.symbol];
      if (lpLogo) {
        well.lpToken.setMetadata({ logo: lpLogo });
      }
    }
    well.tokens.forEach((token) => {
      const address = token.address.toLowerCase();

      let logo = images[token.symbol];
      if (address in tokenMetadata) {
        const metadata = tokenMetadata[address];
        if (metadata?.logoURI) logo = metadata.logoURI;
        if (metadata.displayDecimals) token.displayDecimals = metadata.displayDecimals;
        if (metadata.displayName) token.displayName = metadata.displayName;
      }
      if (logo) token.setMetadata({ logo });
    });
  }
};

export default WellsProvider;
