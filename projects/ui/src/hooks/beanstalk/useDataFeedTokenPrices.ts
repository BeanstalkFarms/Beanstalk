import { BigNumber } from 'bignumber.js';
import { useCallback, useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { TokenMap } from '../../constants/index';
import { bigNumberResult } from '../../util/Ledger';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { CRV3, DAI, ETH, USDC, USDT, WETH } from '../../constants/tokens';
import {
  DAI_CHAINLINK_ADDRESSES,
  USDT_CHAINLINK_ADDRESSES,
  USDC_CHAINLINK_ADDRESSES,
} from '../../constants/addresses';
import { useAggregatorV3Contract } from '~/hooks/ledger/useContract';
import { AppState } from '../../state/index';
import { updateTokenPrices } from '~/state/beanstalk/tokenPrices/actions';
import useSdk from '../sdk';

const getBNResult = (result: any, decimals: number) => {
  const bnResult = bigNumberResult(result);
  const _decimals = new BigNumber(10).pow(decimals);
  return bnResult.dividedBy(_decimals);
};

/**
 * fetches data from Chainlink DataFeeds.
 * Currently supports prices for the following pairs:
 * - DAI/USD
 * - USDT/USD
 * - USDC/USD
 * - ETH/USD
 */
export default function useDataFeedTokenPrices() {
  const tokenPriceMap = useSelector<
    AppState,
    AppState['_beanstalk']['tokenPrices']
  >((state) => state._beanstalk.tokenPrices);

  const sdk = useSdk();

  const daiPriceFeed = useAggregatorV3Contract(DAI_CHAINLINK_ADDRESSES);
  const usdtPriceFeed = useAggregatorV3Contract(USDT_CHAINLINK_ADDRESSES);
  const usdcPriceFeed = useAggregatorV3Contract(USDC_CHAINLINK_ADDRESSES);
  const ethPriceFeed = sdk.contracts.usdOracle;
  const crv3Pool = sdk.contracts.curve.pools.pool3;
  const getChainToken = useGetChainToken();
  const dispatch = useDispatch();

  const fetch = useCallback(async () => {
    if (Object.values(tokenPriceMap).length) return;
    if (!daiPriceFeed || !usdtPriceFeed || !usdcPriceFeed || !ethPriceFeed || !crv3Pool)
      return;

    console.debug('[beanstalk/tokenPrices/useCrvUnderlylingPrices] FETCH');

    const [
      daiPriceData,
      daiPriceDecimals,
      usdtPriceData,
      usdtPriceDecimals,
      usdcPriceData,
      usdcPriceDecimals,
      ethPrice,
      ethPriceTWA,
      crv3Price,
    ] = await Promise.all([
      daiPriceFeed.latestRoundData(),
      daiPriceFeed.decimals(),
      usdtPriceFeed.latestRoundData(),
      usdtPriceFeed.decimals(),
      usdcPriceFeed.latestRoundData(),
      usdcPriceFeed.decimals(),
      ethPriceFeed.getEthUsdPrice(),
      ethPriceFeed.getEthUsdTwa(3600),
      crv3Pool.get_virtual_price(),
    ]);

    const dai = getChainToken(DAI);
    const usdc = getChainToken(USDC);
    const usdt = getChainToken(USDT);
    const eth = getChainToken(ETH);
    const weth = getChainToken(WETH);
    const crv3 = getChainToken(CRV3);

    const priceDataCache: TokenMap<BigNumber> = {};

    if (daiPriceData && daiPriceDecimals) {
      priceDataCache[dai.address] = getBNResult(
        daiPriceData.answer,
        daiPriceDecimals
      );
    }
    if (usdtPriceData && usdtPriceDecimals) {
      priceDataCache[usdt.address] = getBNResult(
        usdtPriceData.answer,
        usdtPriceDecimals
      );
    }
    if (usdcPriceData && usdcPriceDecimals) {
      priceDataCache[usdc.address] = getBNResult(
        usdcPriceData.answer,
        usdcPriceDecimals
      );
    }
    if (ethPrice && ethPriceTWA) {
      priceDataCache[eth.address] = getBNResult(
        ethPrice,
        6
      );
      priceDataCache[weth.address] = getBNResult(
        ethPrice,
        6
      );
      priceDataCache["ETH-TWA"] = getBNResult(
        ethPriceTWA,
        6
      );
    }
    if (crv3Price) {
      priceDataCache[crv3.address] = getBNResult(
        crv3Price,
        crv3.decimals
      );
    }

    console.debug(
      `[beanstalk/tokenPrices/useCrvUnderlyingPrices] RESULT: ${priceDataCache}`
    );

    return priceDataCache;
  }, [
    tokenPriceMap,
    daiPriceFeed,
    usdtPriceFeed,
    usdcPriceFeed,
    ethPriceFeed,
    crv3Pool,
    getChainToken,
  ]);

  const handleUpdatePrices = useCallback(async () => {
    const prices = await fetch();
    prices && dispatch(updateTokenPrices(prices));
  }, [dispatch, fetch]);

  useEffect(() => {
    handleUpdatePrices();
  }, [handleUpdatePrices]);

  return useMemo(() => ({ ...tokenPriceMap }), [tokenPriceMap]);
}
