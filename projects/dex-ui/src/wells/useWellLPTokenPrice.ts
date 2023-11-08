import { useCallback, useEffect, useState } from "react";

import { TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk/Wells";
import useSdk from "src/utils/sdk/useSdk";
import { getPrice } from "src/utils/price/usePrice";

export const useWellLPTokenPrice = (wells: (Well | undefined)[] | undefined) => {
  const [lpTokenPrice, setLPTokenPrice] = useState<TokenValue[]>([]);
  const sdk = useSdk();

  const fetch = useCallback(async () => {
    if (!wells) return;

    const tokenPrices: TokenValue[] = [];

    for (const well of wells) {
      if (!well || !well.tokens || !well.lpToken) {
        tokenPrices.push(TokenValue.ZERO);
        continue;
      }
      const [ttlSupply, ...prices] = await Promise.all([well?.lpToken!.getTotalSupply(), ...well?.tokens.map((t) => getPrice(t, sdk))]);

      const wellReserveValues = well?.reserves?.map((reserve, idx) => reserve.mul(prices?.[idx] || TokenValue.ZERO));
      const tvl = wellReserveValues?.reduce((acc, val) => acc.add(val));
      tokenPrices.push(tvl?.div(ttlSupply) || TokenValue.ZERO);
    }

    setLPTokenPrice(tokenPrices);
  }, [sdk, wells]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data: lpTokenPrice, fetch } as const;
};
