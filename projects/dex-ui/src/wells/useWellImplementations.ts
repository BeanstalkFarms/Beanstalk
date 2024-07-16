import { multicall } from "@wagmi/core";
import { useQuery } from "@tanstack/react-query";
import { config } from "src/utils/wagmi/config";
import { useWells } from "./useWells";
import { queryKeys } from "src/utils/query/queryKeys";
import { useAquifer } from "./aquifer/aquifer";

const aquiferAbiSnippet = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "wellImplementation",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

const getCallObjects = (aquiferAddress: string, addresses: string[]) => {
  return addresses.map((address) => ({
    address: aquiferAddress as "0x{string}",
    abi: aquiferAbiSnippet,
    functionName: "wellImplementation",
    args: [address]
  }));
};

export const useWellImplementations = () => {
  const { data: wells } = useWells();
  const aquifer = useAquifer();

  const addresses = (wells || []).map((well) => well.address);

  const query = useQuery({
    queryKey: queryKeys.wellImplementations(addresses),
    queryFn: async () => {
      if (!wells || !wells.length) return [];

      return multicall(config, {
        contracts: getCallObjects(aquifer.address, addresses)
      });
    },
    select: (data) => {
      return addresses.reduce<Record<string, string>>((prev, curr, i) => {
        const result = data[i];
        if (result.error) return prev;
        if (result.result) {
          prev[curr.toLowerCase()] = result.result.toLowerCase() as string;
        }
        return prev;
      }, {});
    },
    enabled: !!addresses.length,
    staleTime: Infinity
  });

  return query;
};
