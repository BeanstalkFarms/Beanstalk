import { useEffect, useState } from "react";

import type { Token } from "@beanstalk/sdk";
import { SwapBuilder } from "@beanstalk/sdk-wells";

import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";

const getTokenKey = (token: Token) => {
  const address = token.address || `native:${token.symbol.toLowerCase()}`;
  return `${token.chainId}:${address.toLowerCase()}`;
};

export const useSwapBuilder = () => {
  const sdk = useSdk();
  const { data: wells } = useWells();
  const [builder, setBuilder] = useState<SwapBuilder>();
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    if (!wells) return;
    let cancelled = false;

    const loadBuilder = async () => {
      const tokenMap: Record<string, Token> = {};
      const wellAllowlist = new Set(sdk.pools.getWells().map((well) => well.address.toLowerCase()));
      const b = new SwapBuilder(sdk.wells, wellAllowlist);

      for (const well of wells) {
        if (!wellAllowlist.has(well.address.toLowerCase())) {
          continue;
        }

        // only include wells with reserves
        if (well.reserves?.[0]?.lte(0) || well.reserves?.[1]?.lte(0)) {
          continue;
        }

        await b.addWell(well);

        for (const token of well?.tokens || []) {
          const key = getTokenKey(token);
          if (!(key in tokenMap)) {
            tokenMap[key] = token;
          }
        }
      }

      if (!cancelled) {
        setBuilder(b);
        setTokens([...Object.values(tokenMap), sdk.tokens.ETH]);
      }
    };

    void loadBuilder();

    return () => {
      cancelled = true;
    };
  }, [wells, sdk.pools, sdk.wells, sdk.signer, sdk.tokens.ETH]);

  return [builder, tokens] as const;
};
