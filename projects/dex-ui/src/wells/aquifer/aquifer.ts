import { useAtomValue } from "jotai";

import { aquiferAtom } from "src/state/atoms";

export const useAquifer = () => {
  const aquifer = useAtomValue(aquiferAtom);

  if (!aquifer) {
    throw new Error("Aquifer not set");
  }

  return aquifer;
};
