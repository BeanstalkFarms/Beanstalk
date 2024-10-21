import { useCallback } from "react";

import { Well } from "@beanstalk/sdk/Wells";

import { queryKeys } from "src/utils/query/queryKeys";
import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

import { loadSiloAPYData } from "./apyFetcher";

export const useBeanstalkSiloAPYs = () => {
  const sdk = useSdk();

  const query = useChainScopedQuery({
    queryKey: queryKeys.siloWellAPYs,
    queryFn: async () => {
      const data = await loadSiloAPYData(sdk);
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
