import { Token } from "@beanstalk/sdk";
import { atom } from "jotai";
import { isDEV } from "src/settings";
import { TokenSymbolMap } from "src/types";

export const underlyingTokenMapAtom = atom<TokenSymbolMap<Token>>({});
if (isDEV) {
  underlyingTokenMapAtom.debugLabel = "underlyingTokenMap";
}
