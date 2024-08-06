import { Token } from "@beanstalk/sdk";
import { SwapBuilder } from "@beanstalk/sdk-wells";
import { useEffect, useState } from "react";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";

export const useSwapBuilder = () => {
  const sdk = useSdk();
  const { data: wells } = useWells();
  const [builder, setBuilder] = useState<SwapBuilder>();
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    if (!wells) return;
    const tokenMap: Record<string, Token> = {};
    const b = sdk.wells.swapBuilder;

    for (const well of wells) {
      // only include wells with reserves
      if (well.reserves?.[0]?.lte(0) || well.reserves?.[1]?.lte(0)) {
        continue;
      }
      
      b.addWell(well);
      setBuilder(b);

      for (const token of well?.tokens || []) {
        if (!(token.symbol in tokenMap))  {
          tokenMap[token.symbol] = token;
        }
      }
    }
    
    setTokens([...Object.values(tokenMap), sdk.tokens.ETH]);
  }, [wells, sdk.wells.swapBuilder, sdk.signer, sdk.tokens.ETH]);

  return [builder, tokens] as const;
};
