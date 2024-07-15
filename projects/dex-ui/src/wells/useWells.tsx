import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";
import { findWells } from "./wellLoader";
import { Log } from "src/utils/logger";
import tokenMetadataJson from 'src/token-metadata.json';
import { TokenMetadataMap } from "src/types";
import { images } from "src/assets/images/tokens";

export const clearWellsCache = () => findWells.cache.clear?.();

export const useWells = () => {
  const sdk = useSdk();

  return useQuery({
    queryKey: ["wells", sdk],

    queryFn: async () => {
      try {
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
        return wellsResult;
      } catch (err: unknown) {
        Log.module("useWells").debug(`Error during findWells(): ${(err as Error).message}`);
        return [];
      }
    },

    retry: false,
    staleTime: Infinity
  });
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