import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";
import { getWellAddresses } from "./wellLoader";

export const useWells = () => {
  const sdk = useSdk();

  return useQuery<Well[], Error>(
    ["wells", !!sdk.signer],
    async () => {
      const wellAddresses = await getWellAddresses(sdk);
      // console.log('Addresses: ', wellAddresses);
      const res = await Promise.allSettled(
        wellAddresses.map((address) =>
          sdk.wells
            .getWell(address, {
              name: true,
              tokens: true
            })
            .catch((err) => console.log(`Failed to load Well [${address}]: ${err.message}`))
        )
      );

      // filter out errored calls
      return res.map((promise) => (promise.status === "fulfilled" ? promise.value : null)).filter<Well>((p): p is Well => !!p);
    },
    {
      staleTime: Infinity
    }
  );
};
