import { useCallback } from "react";
import { Well } from "@beanstalk/sdk/Wells";
import { BEANETH_MULTIPUMP_ADDRESS } from "src/utils/addresses";
import useSdk from "src/utils/sdk/useSdk";
import { TokenValue } from "@beanstalk/sdk";

export const useBeanstalkSiloWhitelist = () => {
  const sdk = useSdk();

  const getIsWhitelisted = useCallback(
    (well: Well | undefined) => {
      if (!well?.lpToken) return false;
      const token = sdk.tokens.findByAddress(well.lpToken.address);
      return token && sdk.tokens.siloWhitelist.has(token);
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

  const getIsMultiPumpWell = useCallback((well: Well | undefined) => {
    if (!well?.pumps) return false;
    return !!well.pumps.find((pump) => pump.address.toLowerCase() === BEANETH_MULTIPUMP_ADDRESS);
  }, []);

  return {
    getIsWhitelisted,
    getSeedsWithWell,
    getIsMultiPumpWell
  } as const;
};
