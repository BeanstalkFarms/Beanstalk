import { Well } from "@beanstalk/sdk-wells";

import { MULTI_FLOW_PUMP_ADDRESS, MULTI_FLOW_PUMP_V_1PT1_ADDRESS } from "src/utils/addresses";

export const getIsMultiPumpWell = (well: Well | undefined) => {
  let isMultiFlowPumpV1 = false;
  let isMultiFlowPumpV1_1 = false;

  for (const pump of well?.pumps || []) {
    if (!isMultiFlowPumpV1 && pump.address.toLowerCase() === MULTI_FLOW_PUMP_ADDRESS) {
      isMultiFlowPumpV1 = true;
    }

    if (!isMultiFlowPumpV1_1 && pump.address.toLowerCase() === MULTI_FLOW_PUMP_V_1PT1_ADDRESS) {
      isMultiFlowPumpV1_1 = true;
    }
  }

  return {
    isV1: isMultiFlowPumpV1,
    isV1_1: isMultiFlowPumpV1_1,
    isMultiFlow: isMultiFlowPumpV1 || isMultiFlowPumpV1_1
  };
};

export const getIsMultiFlowPumpV1pt1 = (well: Well | undefined) => {
  if (!well?.pumps) return false;
  return !!well.pumps.find((pump) => pump.address.toLowerCase() === MULTI_FLOW_PUMP_V_1PT1_ADDRESS);
};
