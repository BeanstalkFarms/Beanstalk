import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";
import { findWells } from "./wellLoader";
import { Log } from "src/utils/logger";

export const useWells = () => {
  const sdk = useSdk();

  return useQuery<Well[], Error>(
    ["wells", sdk],
    async () => {
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
                reserves: true,
                lpToken: true
              })
              .catch((err) => {
                Log.module("wells").log(`Failed to load Well [${address}]: ${err.message}`);
              })
          )
        );

        // filter out errored calls
        return res.map((promise) => (promise.status === "fulfilled" ? promise.value : null)).filter<Well>((p): p is Well => !!p);
      } catch (err: unknown) {
        Log.module("useWells").debug(`Error during findWells(): ${(err as Error).message}`);
        return [];
      }
    },
    {
      retry: false,
      staleTime: Infinity
    }
  );
};
