import { useCallback } from "react";
import { Well } from "@beanstalk/sdk/Wells";
import { MULTI_FLOW_PUMP_ADDRESS } from "src/utils/addresses";
import useSdk from "src/utils/sdk/useSdk";

export const getIsMultiPumpWell = (well: Well | undefined) => {
  if (!well?.pumps) return false;
  return !!well.pumps.find((pump) => pump.address.toLowerCase() === MULTI_FLOW_PUMP_ADDRESS);
};

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
    getSeedsWithWell,
    getIsMultiPumpWell
  } as const;
};
