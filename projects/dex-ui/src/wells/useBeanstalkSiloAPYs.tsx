import { useQuery } from "@tanstack/react-query";
import { loadSiloAPYData } from "./apyFetcher";
import { Well } from "@beanstalk/sdk/Wells";
import { useCallback } from "react";
import { useBeanstalkSiloWhitelist } from "./useBeanstalkSiloWhitelist";

export const useBeanstalkSiloAPYs = () => {
  const { getSeedsWithWell } = useBeanstalkSiloWhitelist();

  const query = useQuery(
    ["wells", "APYs"],
    async () => {
      const data = await loadSiloAPYData();
      return data;
    },
    {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false
    }
  );

  const getSiloAPYWithWell = useCallback(
    (well: Well | undefined) => {
      const seeds = getSeedsWithWell(well);
      if (!query.data || !seeds) return undefined;

      const d = query.data;

      switch (seeds) {
        case 0:
          return d.zeroSeedBeanAPY;
        case 2:
          return d.twoSeedBeanAPY;
        case 3:
          return d.threeSeedBeanAPY;
        case 3.5:
          return d.threePointTwoFiveSeedBeanAPY;
        case 4:
          return d.fourSeedBeanAPY;
        case 4.5:
          return d.fourPointFiveSeedBeanAPY;
        default:
          return undefined;
      }
    },
    [getSeedsWithWell, query.data]
  );

  return {
    ...query,
    getSiloAPYWithWell
  };
};
