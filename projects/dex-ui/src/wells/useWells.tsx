import { WELL_ADDRESSES } from "src/constants/addresses";
import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";

export const useWells = () => {
  const sdk = useSdk();

  return useQuery<Well[], Error>(
    ["wells"],
    () => {
      console.log("Fetching wells");
      return Promise.all(
        WELL_ADDRESSES.map((address) => {
          return sdk.wells.getWell(address, {
            name: true,
            tokens: true
          });
        })
      );
    },
    {
      staleTime: Infinity
    }
  );
};
