import { useCallback, useEffect, useState } from "react";

import { TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk/Wells";
import useSdk from "src/utils/sdk/useSdk";
import { getPrice } from "src/utils/price/usePrice";

export const useWellLPTokenPrice = (well: Well | undefined) => {
  const [lpTokenPrice, setLPTokenPrice] = useState<TokenValue>(TokenValue.ZERO);
  const sdk = useSdk();

  const fetch = useCallback(async () => {
    if (!well || !well.tokens || !well.lpToken) return;
    const [ttlSupply, ...prices] = await Promise.all([well?.lpToken!.getTotalSupply(), ...well?.tokens.map((t) => getPrice(t, sdk))]);

    const wellReserveValues = well?.reserves?.map((reserve, idx) => reserve.mul(prices?.[idx] || TokenValue.ZERO));
    const tvl = wellReserveValues?.reduce((acc, val) => acc.add(val));

    setLPTokenPrice(tvl?.div(ttlSupply) || TokenValue.ZERO);
  }, [sdk, well]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data: lpTokenPrice, fetch } as const;
};
