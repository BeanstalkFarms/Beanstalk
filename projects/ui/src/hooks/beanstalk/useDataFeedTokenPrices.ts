import { BigNumber } from 'bignumber.js';
import { useCallback, useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { useAggregatorV3Contract } from '~/hooks/ledger/useContract';
import { updateTokenPrices } from '~/state/beanstalk/tokenPrices/actions';
import { TokenMap } from '../../constants/index';
import { bigNumberResult } from '../../util/Ledger';
import { DAI, ETH, USDC, USDT, WETH, WSTETH } from '../../constants/tokens';
import {
  DAI_CHAINLINK_ADDRESSES,
  USDT_CHAINLINK_ADDRESSES,
  USDC_CHAINLINK_ADDRESSES,
} from '../../constants/addresses';
import { useAppSelector } from '../../state/index';
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
  const tokenPriceMap = useAppSelector((state) => state._beanstalk.tokenPrices);

  const sdk = useSdk();
  const beanstalk = sdk.contracts.beanstalk;

  const daiPriceFeed = useAggregatorV3Contract(DAI_CHAINLINK_ADDRESSES);
  const usdtPriceFeed = useAggregatorV3Contract(USDT_CHAINLINK_ADDRESSES);
  const usdcPriceFeed = useAggregatorV3Contract(USDC_CHAINLINK_ADDRESSES);
  const usdOracle = sdk.contracts.usdOracle;
  const getChainToken = useGetChainToken();
  const dispatch = useDispatch();

  const fetch = useCallback(async () => {
    if (Object.values(tokenPriceMap).length) return;
    if (!daiPriceFeed || !usdtPriceFeed || !usdcPriceFeed || !usdOracle) return;

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
      wstETHPrice,
      wstETHPriceTWA,
    ] = await Promise.all([
      daiPriceFeed.latestRoundData(),
      daiPriceFeed.decimals(),
      usdtPriceFeed.latestRoundData(),
      usdtPriceFeed.decimals(),
      usdcPriceFeed.latestRoundData(),
      usdcPriceFeed.decimals(),
      // beanstalk.getTokenUsdPrice(sdk.tokens.WETH.address),
      usdOracle.getEthUsdPrice(),
      usdOracle.getEthUsdTwap(0),
      usdOracle.getWstethUsdPrice(),
      usdOracle.getWstethUsdTwap(0),
    ]);

    const dai = getChainToken(DAI);
    const usdc = getChainToken(USDC);
    const usdt = getChainToken(USDT);
    const eth = getChainToken(ETH);
    const weth = getChainToken(WETH);
    const wstETH = getChainToken(WSTETH);

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
      priceDataCache[eth.address] = getBNResult(ethPrice, 6);
      priceDataCache[weth.address] = getBNResult(ethPrice, 6);
      priceDataCache['ETH-TWA'] = getBNResult(ethPriceTWA, 6);
    }

    if (wstETHPrice && wstETHPriceTWA) {
      priceDataCache[wstETH.address] = getBNResult(wstETHPrice, 6);
      priceDataCache['wstETH-TWA'] = getBNResult(wstETHPriceTWA, 6);
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
    usdOracle,
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
