import React, { useEffect } from "react";

import { useSetAtom } from "jotai";

import { Well } from "@beanstalk/sdk-wells";

import { images } from "src/assets/images/tokens";
import { Error } from "src/components/Error";
import { setWellsLoadingAtom, wellsAtom } from "src/state/atoms";
import tokenMetadataJson from "src/token-metadata.json";
import { TokenMetadataMap } from "src/types";
import { Log } from "src/utils/logger";
import { queryKeys } from "src/utils/query/queryKeys";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";
import { useAquifer } from "src/wells/aquifer/aquifer";
import { findWells } from "src/wells/wellLoader";

export const clearWellsCache = () => findWells.cache.clear?.();

export const useWellsQuery = () => {
  const sdk = useSdk();

  const aquifer = useAquifer();
  const setWells = useSetAtom(wellsAtom);
  const setWellsLoading = useSetAtom(setWellsLoadingAtom);

  const query = useChainScopedQuery({
    queryKey: queryKeys.wells(sdk),
    queryFn: async () => {
      const wellAddresses = await findWells(sdk, aquifer);

      try {
        setWellsLoading(true);
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

        return wellsResult;
      } catch (err: any) {
        Log.module("useWells").debug(`Error during findWells(): ${(err as Error).message}`);
        return [];
      }
    },
    enabled: !!sdk && !!aquifer,
    retry: false,
    staleTime: Infinity
  });

  useEffect(() => {
    setWells({ data: query.data || [], error: query.error, isLoading: query.isLoading });
  }, [query.data, query.error, query.isLoading, setWells]);

  return query;
};

const WellsProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  const query = useWellsQuery();

  if (!query.data?.length) {
    return null;
  }

  if (query.error) {
    return <Error message={query.error.message} />;
  }

  return <>{children}</>;
});

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
