import { Well, WellFunction } from "@beanstalk/sdk-wells";
import { useQuery } from "@tanstack/react-query";
import { AddressMap } from "src/types";
import { queryKeys } from "src/utils/query/queryKeys";

interface WellWithWellFn extends Well {
  wellFunction: WellFunction;
}

/**
 * Returns a Record of well function addresses to their names.
 */
export const useWellFunctionNames = (_wells: Well[] | undefined) => {
  const wells = _wells || [];

  const wellsWithWellFunctions = wells.filter((w) => !!w.wellFunction) as WellWithWellFn[];
  const addresses = wellsWithWellFunctions.map((well) => well.wellFunction.address);

  return useQuery({
    queryKey: queryKeys.wellFunctionNames(addresses.length ? addresses : ["invalid"]),
    queryFn: async () => {
      // TODO: make me into a multi call at some point.
      const names = await Promise.all(
        wellsWithWellFunctions.map((well) => well.wellFunction.getName())
      );

      return wellsWithWellFunctions.reduce<AddressMap<string>>((prev, curr, i) => {
        prev[curr.wellFunction.address] = names[i];
        return prev;
      }, {});
    },
    enabled: !!wells.length
  });
};
