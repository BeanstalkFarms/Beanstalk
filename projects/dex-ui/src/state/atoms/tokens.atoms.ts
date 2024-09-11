import { atom } from "jotai";

import { ERC20Token, NativeToken, Token } from "@beanstalk/sdk";

import { isDEV } from "src/settings";
import { wellsAtom, sdkAtom } from "src/state/atoms";
import { getTokenIndex } from "src/tokens/utils";
import { TokenSymbolMap } from "src/types";

const ethAtom = atom<NativeToken | null>((get) => {
  const sdk = get(sdkAtom);
  if (!sdk) return null;
  return sdk.tokens.ETH;
});

export const underlyingTokenMapAtom = atom<TokenSymbolMap<Token>>((get) => {
  const eth = get(ethAtom);
  const wells = get(wellsAtom);

  if (!eth || !wells.data.length) return {};
  const tokenMap = (wells.data || []).reduce<TokenSymbolMap<Token>>(
    (prev, well) => {
      if (well.tokens && Array.isArray(well.tokens)) {
        well.tokens.forEach((token) => {
          prev[token.symbol] = token;
        });
      }
      return prev;
    },
    {
      [getTokenIndex(eth)]: eth
    }
  );

  return tokenMap;
});

export const wellLpTokensAtom = atom<ERC20Token[]>((get) => {
  const wells = get(wellsAtom);

  return wells.data.map((well) => well.lpToken).filter(Boolean) as ERC20Token[];
});

if (isDEV) {
  ethAtom.debugLabel = "eth";
  underlyingTokenMapAtom.debugLabel = "underlyingTokenMap";
}
