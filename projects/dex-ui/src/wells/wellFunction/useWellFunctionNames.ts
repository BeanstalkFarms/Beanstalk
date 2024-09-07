import { useQuery } from "@tanstack/react-query";
import { multicall } from "@wagmi/core";
import { ContractFunctionParameters, MulticallReturnType } from "viem";

import { Well, WellFunction } from "@beanstalk/sdk-wells";

import { AddressMap } from "src/types";
import { Log } from "src/utils/logger";
import { queryKeys } from "src/utils/query/queryKeys";
import { config } from "src/utils/wagmi/config";

interface WellWithWellFn extends Well {
  wellFunction: WellFunction;
}

const Logger = Log.module("useWellFunctionNames");

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
      Logger.debug(`Fetching well function names for wells: ${addresses}`);
      const calls = makeMultiCall(wellsWithWellFunctions);
      const names = await multicall(config, { contracts: calls, allowFailure: true });
      Logger.debug(`Well function names: ${names}`);

      return wellsWithWellFunctions.reduce<AddressMap<string>>((prev, curr, i) => {
        const result = extractResult(names[i]);
        if (!result) return prev;
        prev[curr.wellFunction.address] = result as string;
        return prev;
      }, {});
    },
    enabled: !!wells.length
  });
};

const extractResult = (result: MulticallReturnType[number]) => {
  if (result.error) return null;
  return result.result as string;
};

const makeMultiCall = (wells: WellWithWellFn[]) => {
  const calls: ContractFunctionParameters<typeof WellFunction.abi>[] = wells.map((well) => {
    return {
      address: well.wellFunction.address as `0x{string}`,
      abi: WellFunction.abi,
      functionName: "name",
      args: []
    };
  });

  return calls;
};
