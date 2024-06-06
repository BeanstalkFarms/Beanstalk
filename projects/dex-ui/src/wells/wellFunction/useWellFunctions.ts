import { useMemo } from "react";
import { WellFunction } from "@beanstalk/sdk-wells";

import { useWells } from "src/wells/useWells";

export const useWellFunctions = () => {
  const { data: wells } = useWells();

  return useMemo(() => {
    if (!wells || !wells.length) return [];

    const wellFunctionMap: Record<string, WellFunction> = {};

    for (const well of wells) {
      if (!well.wellFunction) continue;
      const address = well.wellFunction.address.toLowerCase();

      if (!(address in wellFunctionMap)) {
      }
    }

    return Object.values(wellFunctionMap);
  }, [wells]);
};
