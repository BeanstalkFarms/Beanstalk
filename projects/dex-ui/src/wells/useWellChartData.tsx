import { useQuery } from "@tanstack/react-query";

import useSdk from "src/utils/sdk/useSdk";
import { loadChartData } from "./chartDataLoader";
import { Well } from "@beanstalk/sdk/Wells";

const useWellChartData = (well: Well, timePeriod: string) => {
  const sdk = useSdk();

  return useQuery(
    ["wells", "wellChartData", well.address],
    async () => {
      const data = await loadChartData(sdk, well, timePeriod);

      return data;
    },
    {
      staleTime: 1000 * 60
    }
  );
};

export default useWellChartData;
