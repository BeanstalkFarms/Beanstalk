import { useQuery } from "@tanstack/react-query";
import { loadSiloAPYData } from "./apyFetcher";
import { Well } from "@beanstalk/sdk/Wells";
import { useCallback } from "react";

export const useBeanstalkSiloAPYs = () => {
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
      const lpToken = well?.lpToken;
      if (!query.data || !lpToken?.address) return undefined;

      return query.data.tokenAPYs[lpToken.address];
    },
    [query.data]
  );

  return {
    ...query,
    getSiloAPYWithWell
  };
};
