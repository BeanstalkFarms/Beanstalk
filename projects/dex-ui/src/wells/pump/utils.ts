import { useCallback, useMemo } from "react";

import { Well } from "@beanstalk/sdk-wells";

import useSdk from "src/utils/sdk/useSdk";

export const useIsMultiFlowPump = (well: Well | undefined = undefined) => {
  const sdk = useSdk();

  const getIsMultiFlow = useCallback(
    (_well: Well | undefined) => {
      let isMultiFlowPumpV1 = false;
      let isMultiFlowPumpV1_1 = false;

      const mfPumpV1Address = sdk.wells.addresses.MULTI_FLOW_PUMP_V1.get(sdk.chainId);
      const mfPumpV1_1Address = sdk.wells.addresses.MULTI_FLOW_PUMP_V1_1.get(sdk.chainId);

      for (const pump of _well?.pumps || []) {
        const pumpAddress = pump.address.toLowerCase();

        if (pumpAddress === mfPumpV1Address) {
          isMultiFlowPumpV1 = true;
        }

        if (pumpAddress === mfPumpV1_1Address) {
          isMultiFlowPumpV1_1 = true;
        }
      }

      return {
        isV1: isMultiFlowPumpV1,
        isV1_1: isMultiFlowPumpV1_1,
        isMultiFlow: isMultiFlowPumpV1 || isMultiFlowPumpV1_1
      };
    },
    [sdk]
  );

  return useMemo(() => {
    return {
      ...getIsMultiFlow(well),
      getIsMultiFlow
    };
  }, [well, getIsMultiFlow]);
};
