import { Well } from "@beanstalk/sdk/Wells";

import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

import { loadChartData } from "./chartDataLoader";

const useWellChartData = (well: Well, timePeriod: string) => {
  const sdk = useSdk();

  return useChainScopedQuery({
    queryKey: ["wells", "wellChartData", well.address],

    queryFn: async () => {
      const data = await loadChartData(sdk, well, timePeriod);

      return data;
    },

    staleTime: 1000 * 60
  });
};

export default useWellChartData;
