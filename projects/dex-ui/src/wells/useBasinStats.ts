import { ChainId } from "@beanstalk/sdk-core";

import { BasinAPIResponse } from "src/types";
import { Log } from "src/utils/logger";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";

const useBasinStats = () => {
  return useChainScopedQuery({
    queryKey: ["wells", "basinStats"],
    queryFn: async ({ queryKey }) => {
      const scopedChainId = queryKey[0];
      const id = Array.isArray(scopedChainId) ? scopedChainId[0] : scopedChainId;
      const param = id === ChainId.ETH_MAINNET ? "eth" : `arb`;
      let output: BasinAPIResponse[] = [];
      try {
        const apiQuery = await fetch(`https://api.bean.money/basin/tickers?chain=${param}`, {
          headers: { accept: "application/json" }
        });

        const result = await apiQuery.json();
        if (Array.isArray(result)) {
          output = result as BasinAPIResponse[];
        } else {
          if ("message" in result) {
            throw new Error(result);
          }
        }
      } catch (e) {
        Log.module("useBasinStats").error("Failed to fetch data from Basin API :", e);
      }
      return output;
    },
    staleTime: 1000 * 120
  });
};

export default useBasinStats;
