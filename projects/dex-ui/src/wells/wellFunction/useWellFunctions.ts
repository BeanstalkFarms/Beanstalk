import { useCallback, useMemo } from "react";

import { multicall } from "@wagmi/core";
import { ContractFunctionParameters } from "viem";

import { Well, WellFunction } from "@beanstalk/sdk-wells";

import { chunkArray } from "src/utils/array";
import { queryKeys } from "src/utils/query/queryKeys";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import { config } from "src/utils/wagmi/config";
import { useWells } from "src/wells/useWells";

type WellFunctionDataMap = Record<
  string,
  {
    name: string;
    symbol: string;
  }
>;

export const useWellFunctions = () => {
  const { data: wells } = useWells();

  const addresses = getWFAddresses(wells);

  const selectData = useCallback(
    (data: WellFunctionDataMap) => {
      if (!data) return [];

      // apply the changes to all wells
      for (const well of wells) {
        const wf = well.wellFunction;
        if (!wf || !!(wf.name && wf.symbol)) continue;

        const { name, symbol } = data[wf.address.toLowerCase()];
        if (name && symbol) {
          wf.name = name;
          wf.symbol = symbol;
        }
      }

      return Object.values(mapWellFunctions(wells));
    },
    [wells]
  );

  const query = useChainScopedQuery({
    queryKey: queryKeys.wellFunctions(addresses),
    queryFn: async () => {
      const { contracts, chunkSize } = buildMulticall(addresses);

      const results = await multicall(config, { contracts, allowFailure: false }).then((r) =>
        chunkArray(r, chunkSize)
      );

      return addresses.reduce<Record<string, { name: string; symbol: string }>>(
        (prev, wfAddress, i) => {
          const [name, symbol] = results[i];
          prev[wfAddress] = { name, symbol };
          return prev;
        },
        {}
      );
    },
    select: selectData,
    enabled: !!wells.length
  });

  return useMemo(() => query.data || [], [query.data]);
};

const mapWellFunctions = (wells: Well[]) => {
  return wells.reduce<Record<string, WellFunction>>((prev, well) => {
    if (!well.wellFunction) return prev;
    const address = well.wellFunction.address.toLowerCase();

    if (!prev[address]) {
      prev[address] = well.wellFunction;
    }
    return prev;
  }, {});
};

const getWFAddresses = (wells: Well[]) => {
  const set = new Set<string>(wells.map((well) => well.wellFunction?.address?.toLowerCase() || ""));
  set.delete("");
  return Array.from(set);
};

const buildMulticall = (addresses: string[]) => {
  const calls: ContractFunctionParameters<typeof WellFunction.abi>[][] = addresses.map(
    (address) => {
      const contract = {
        address: address as `0x${string}`,
        abi: WellFunction.abi
      };
      return [
        { ...contract, functionName: "name", args: [] },
        { ...contract, functionName: "symbol", args: [] }
      ];
    }
  );

  return { contracts: calls.flat(), chunkSize: 2 };
};
