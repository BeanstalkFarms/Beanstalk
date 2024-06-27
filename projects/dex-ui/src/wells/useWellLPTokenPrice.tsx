import { useMemo } from "react";
import { ERC20Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk/Wells";
import { useTokenSupplyMany } from "src/tokens/useTokenSupply";
import { AddressMap } from "src/types";
import { useTokenPrices } from "src/utils/price/useTokenPrices";

/**
 * LP Token Price is calculated as: TVL / total supply
 * where:
 * - TVL = (reserve1 amount  * token1 price ) + (reserve2 amount + token2 price)
 */

export const useWellLPTokenPrice = (params: Well | Well[] | undefined) => {
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

  const { totalSupply: tokenSupplies, loading } = useTokenSupplyMany(lpTokens);
  const { data: prices, isLoading: tokenPricesLoading } = useTokenPrices(wells);

  const lpTokenPrices = useMemo(() => {
    if (!wells || !tokenSupplies?.length || !prices) return undefined;
    const lpTokenPrices: AddressMap<TokenValue> = {};

    for (const wellIdx in wells) {
      const well = wells[wellIdx];

      const tokens = well?.tokens;
      const reserves =
        well?.reserves && well.reserves.length === 2
          ? well.reserves
          : [TokenValue.ZERO, TokenValue.ZERO];
      const lpToken = well?.lpToken;
      const lpTokenSupply = tokenSupplies[wellIdx] || TokenValue.ONE;

      if (well && tokens && lpToken) {
        const hasAllPrices = tokens.every((tk) => tk.symbol in prices);

        const wellReserveValues = reserves.map((reserve, rIdx) => {
          if (hasAllPrices) {
            return reserve.mul(prices[tokens[rIdx].symbol] || TokenValue.ZERO);
          }
          return TokenValue.ZERO;
        });

        const wellTVL = wellReserveValues?.reduce((acc, val) => acc.add(val));
        lpTokenPrices[lpToken.address] =
          wellTVL && lpTokenSupply.gt(0) ? wellTVL.div(lpTokenSupply) : TokenValue.ZERO;
      }
    }

    return lpTokenPrices;
  }, [prices, tokenSupplies, wells]);

  return {
    data: lpTokenPrices,
    isLoading: loading || tokenPricesLoading
  };
};
