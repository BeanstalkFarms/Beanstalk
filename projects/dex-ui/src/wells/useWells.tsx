import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";
import { getWellAddresses } from "./wellLoader";
import { Log } from "src/utils/logger";

export const useWells = () => {
  const sdk = useSdk();

  return useQuery<Well[], Error>(
    ["wells", sdk],
    async () => {
      const wellAddresses = await getWellAddresses(sdk);
      Log.module("wells").debug("Well addresses: ", wellAddresses);

      // TODO: convert this to a multicall at some point
      const res = await Promise.allSettled(
        wellAddresses.map((address) =>
          sdk.wells
            .getWell(address, {
              name: true,
              tokens: true
            })
            .catch((err) => {
              Log.module("wells").log(`Failed to load Well [${address}]: ${err.message}`);
            })
        )
      );

      // filter out errored calls
      return res.map((promise) => (promise.status === "fulfilled" ? promise.value : null)).filter<Well>((p): p is Well => !!p);
    },
    {
      retry: false,
      staleTime: Infinity
    }
  );
};
