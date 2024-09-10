import React, { useEffect } from "react";

import { useSetAtom } from "jotai";

import { Well } from "@beanstalk/sdk-wells";

import { images } from "src/assets/images/tokens";
import { Error } from "src/components/Error";
import { wellsAtom } from "src/state/atoms";
import tokenMetadataJson from "src/token-metadata.json";
import { TokenMetadataMap } from "src/types";
import { Log } from "src/utils/logger";
import { queryKeys } from "src/utils/query/queryKeys";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";
import { useAquifer } from "src/wells/aquifer/aquifer";
import { fetchWellsWithAddresses, findWells } from "src/wells/wellLoader";

export const clearWellsCache = () => {
  // findWells.cache.clear?.();
};

export const useWellsQuery = () => {
  const sdk = useSdk();

  const aquifer = useAquifer();
  const setWells = useSetAtom(wellsAtom);

  const query = useChainScopedQuery({
    queryKey: queryKeys.wells(sdk),
    queryFn: async () => {
      const wellAddresses = await findWells(sdk, aquifer);
      // console.log("finding wells...");
      try {
        Log.module("wells").debug("Well addresses: ", wellAddresses);
        const wells = await fetchWellsWithAddresses(sdk, wellAddresses);
        Log.module("wells").debug("Wells response: ", wells);
        setTokenMetadatas(wells);

        return wells;
      } catch (err: any) {
        Log.module("useWells").debug(`Error during findWells(): ${(err as Error).message}`);
        return [];
      }
    },
    enabled: !!sdk && !!aquifer && !!sdk.wells,
    retry: false,
    staleTime: Infinity
  });

  // console.log("enabled: ", !!sdk && !!aquifer && !!sdk.wells);

  useEffect(() => {
    setWells({ data: query.data || [], error: query.error, isLoading: query.isLoading });
  }, [query.data, query.error, query.isLoading, setWells]);

  return query;
};

const WellsProvider = React.memo(({ children }: { children: React.ReactNode }) => {
  const query = useWellsQuery();
  if (!query.data?.length) {
    // console.log("nowells...");
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

// function compareWells(_a: Well[], b: Well[]) {
//   const aMap = Object.fromEntries(_a.map((well) => [well.address.toLowerCase(), well]));

//   b.forEach((well) => {
//     const match = aMap[well.address.toLowerCase()];
//     if (!match) {
//       console.log("b WELL NOT FOUND in a", well.address.toLowerCase());
//       return;
//     }

//     if (well.toJSON() !== match.toJSON()) {
//       console.log("WELLS DO NOT MATCH", well.address.toLowerCase());
//       console.log("A:", well.toJSON());
//       console.log("B:", match.toJSON());
//     }
//   });
// }
