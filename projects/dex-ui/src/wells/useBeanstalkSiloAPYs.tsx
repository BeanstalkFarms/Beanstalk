import { useCallback } from "react";

import { Well } from "@beanstalk/sdk/Wells";

import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";

import { loadSiloAPYData } from "./apyFetcher";

export const useBeanstalkSiloAPYs = () => {
  const query = useChainScopedQuery({
    queryKey: ["wells", "APYs"],

    queryFn: async () => {
      const data = await loadSiloAPYData();
      return data;
    },

    staleTime: 1000 * 60,
    refetchOnWindowFocus: false
  });

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
