import { useMemo } from "react";

import { Well, WellFunction } from "@beanstalk/sdk-wells";

import useSdk from "src/utils/sdk/useSdk";

export const useIsConstantProduct2 = (param: Well | WellFunction | undefined | null) => {
  const sdk = useSdk();

  return useMemo(() => {
    const addresses = sdk.wells.addresses;
    const cp2V1 = addresses.CONSTANT_PRODUCT_2_V1;
    const cp2V2 = addresses.CONSTANT_PRODUCT_2_V2;
    const cp2 = [cp2V1, cp2V2];

    if (!param) return false;

    const wf = param instanceof Well ? param.wellFunction : param;

    return (
      wf &&
      cp2.some((_address) => {
        const address = _address.get(sdk.chainId) || "";
        return address.toLowerCase() === wf.address.toLowerCase();
      })
    );
  }, [param, sdk.chainId, sdk.wells.addresses]);
};
