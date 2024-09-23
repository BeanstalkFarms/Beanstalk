import { useAtomValue } from "jotai";

import { wellsAtom } from "src/state/atoms";

export const useWells = () => {
  const atom = useAtomValue(wellsAtom);
  return atom;
};
