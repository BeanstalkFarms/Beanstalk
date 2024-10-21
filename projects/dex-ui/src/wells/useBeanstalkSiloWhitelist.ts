import { useCallback } from "react";

import { Well } from "@beanstalk/sdk/Wells";

import useSdk from "src/utils/sdk/useSdk";

export const useBeanstalkSiloWhitelist = () => {
  const sdk = useSdk();

  const getIsWhitelisted = useCallback(
    (well: Well | undefined) => {
      if (!well?.lpToken) return false;
      const token = sdk.tokens.findByAddress(well.lpToken.address);
      return Boolean(token && sdk.tokens.siloWhitelist.has(token));
    },
    [sdk.tokens]
  );

  const getSeedsWithWell = useCallback(
    (well: Well | undefined) => {
      if (!well?.lpToken) return undefined;
      return sdk.tokens.findByAddress(well.lpToken.address)?.getSeeds();
    },
    [sdk.tokens]
  );

  return {
    getIsWhitelisted,
    getSeedsWithWell
  } as const;
};
