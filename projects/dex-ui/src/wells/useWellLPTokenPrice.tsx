import { useCallback, useEffect, useMemo, useState } from "react";
import { ERC20Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk/Wells";
import useSdk from "src/utils/sdk/useSdk";
import { getPrice } from "src/utils/price/usePrice";
import { useTokenSupplyMany } from "src/tokens/useTokenSupply";

type TokenMap<T> = Record<string, T>;

/**
 * LP Token Price is calculated as: TVL / total supply
 * where:
 * - TVL = (reserve1 amount  * token1 price ) + (reserve2 amount + token2 price)
 */

export const useWellLPTokenPrice = (params: Well | (Well | undefined)[] | undefined) => {
  const [lpTokenPriceMap, setLPTokenPriceMap] = useState<TokenMap<TokenValue>>({});
  const sdk = useSdk();

  const wells = useMemo(() => {
    // Make into array for easier processing
    if (!params) return [];
    return Array.isArray(params) ? params : [params];
  }, [params]);

  const lpTokens = useMemo(() => {
    if (!wells || !wells.length) return [];
    const _tokens: ERC20Token[] = [];
    wells.forEach((well) => well?.lpToken && _tokens.push(well.lpToken));
    return _tokens;
  }, [wells]);

  const { totalSupply: tokenSupplies } = useTokenSupplyMany(lpTokens);

  const fetchData = useCallback(async () => {
    if (!wells || !tokenSupplies?.length) return;

    const fetchTokenPrices = async () => {
      const _tokenMap = wells.reduce<TokenMap<ERC20Token>>((memo, well) => {
        if (!well || !well?.tokens) return memo;
        well.tokens.forEach((token) => (memo[token.address] = token));
        return memo;
      }, {});

      const tokenLyst = Object.entries(_tokenMap);

      const prices = await Promise.all(tokenLyst.map(([, token]) => getPrice(token, sdk)));
      const data = tokenLyst.reduce<TokenMap<TokenValue>>((memo, [tokenAddress], index) => {
        memo[tokenAddress] = prices[index] || TokenValue.ZERO;
        return memo;
      }, {});
      return data;
    };

    const tokenPriceMap = await fetchTokenPrices();

    const lpTokenPrices: TokenMap<TokenValue> = {};

    for (const wellIdx in wells) {
      const well = wells[wellIdx];

      const tokens = well?.tokens;
      const reserves = well?.reserves && well.reserves.length === 2 ? well.reserves : [TokenValue.ZERO, TokenValue.ZERO];
      const lpToken = well?.lpToken;
      const lpTokenSupply = tokenSupplies[wellIdx] || TokenValue.ONE;

      if (well && tokens && lpToken) {
        const wellReserveValues = reserves.map((reserve, rIdx) => reserve.mul(tokenPriceMap[tokens[rIdx].address] || TokenValue.ZERO));
        const wellTVL = wellReserveValues?.reduce((acc, val) => acc.add(val));
        lpTokenPrices[lpToken.address] = wellTVL && lpTokenSupply.gt(0) ? wellTVL.div(lpTokenSupply) : TokenValue.ZERO;
      }
    }
    setLPTokenPriceMap(lpTokenPrices);
  }, [sdk, tokenSupplies, wells]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data: lpTokenPriceMap, fetch: fetchData } as const;
};
