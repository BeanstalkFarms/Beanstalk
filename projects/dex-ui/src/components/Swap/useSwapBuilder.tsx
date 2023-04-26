import { SwapBuilder } from "@beanstalk/wells";
import { useEffect, useState } from "react";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";

export const useSwapBuilder = () => {
  const sdk = useSdk();
  const { data: wells } = useWells();
  const [builder, setBuilder] = useState<SwapBuilder>();

  useEffect(() => {
    if (!wells) return;
    // if (!sdk.signer) return;
    const b = sdk.wells.swapBuilder;

    for (const well of wells) {
      b.addWell(well);
      setBuilder(b);
    }
  }, [wells, sdk.wells.swapBuilder, sdk.signer]);

  return builder;
};
