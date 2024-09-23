import { useMemo } from "react";

import { useAtomValue } from "jotai";

import { underlyingTokenMapAtom } from "src/state/atoms";

export function useTokens() {
  return useAtomValue(underlyingTokenMapAtom);
}

export const useTokensArr = () => {
  const tokens = useTokens();
  return useMemo(() => Object.values(tokens), [tokens]);
};
