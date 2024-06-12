import { useMemo } from "react";
import { Aquifer } from "@beanstalk/sdk-wells";
import { Settings } from "src/settings";

import useSdk from "src/utils/sdk/useSdk";

export const useAquifer = () => {
  const sdk = useSdk();

  return useMemo(() => {
    return new Aquifer(sdk.wells, Settings.AQUIFER_ADDRESS);
  }, [sdk.wells]);
};
