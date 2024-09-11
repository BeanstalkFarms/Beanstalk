import { useAtomValue } from "jotai";

import { wellLpTokensAtom } from "src/state/atoms";

export const useWellLPTokens = () => {
  return useAtomValue(wellLpTokensAtom);
};
