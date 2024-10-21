import { useCallback, useMemo } from 'react';
import { AdvancedPipeStruct, BeanstalkSDK, Clipboard, ERC20Token } from '@beanstalk/sdk';
import { BigNumber } from 'bignumber.js';
import { useDispatch } from 'react-redux';

import { useAggregatorV3Contract } from '~/hooks/ledger/useContract';
import { updateTokenPrices } from '~/state/beanstalk/tokenPrices/actions';
import { chunkArray, bigNumberResult, getTokenIndex, tokenIshEqual } from '~/util';
import { TokenMap } from '~/constants/index';
import { DAI_CHAINLINK_ADDRESSES } from '~/constants/addresses';
import { useAppSelector } from '~/state/index';
import useSdk from '~/hooks/sdk';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';

const getBNResult = (result: any, decimals: number) => {
  const bnResult = bigNumberResult(result);
  const _decimals = new BigNumber(10).pow(decimals);
  return bnResult.dividedBy(_decimals);
};

/**
 * fetches data from Chainlink DataFeeds.
 * Currently supports prices for the following pairs:
 * - DAI/USD
 *
 * - Other tokens are fetched from the Beanstalk oracle
 */
export default function useDataFeedTokenPrices() {
  const tokenPriceMap = useAppSelector((state) => state._beanstalk.tokenPrices);

  const sdk = useSdk();
  const tokens = useTokens();

  const daiPriceFeed = useAggregatorV3Contract(DAI_CHAINLINK_ADDRESSES);
  const dispatch = useDispatch();

  const hasEntries = Object.values(tokenPriceMap).length;

  const fetch = useCallback(async () => {
    if (hasEntries || !daiPriceFeed) return;

    const underlyingTokens = [
      tokens.WETH,
      tokens.WSTETH,
      tokens.WBTC,
      tokens.WEETH,
      tokens.USDT,
      tokens.USDC,
    ];

    console.debug('[beanstalk/tokenPrices/useDataFeedTokenPrices] FETCH');

    const [daiPriceData, daiPriceDecimals, oracleResults] = await Promise.all([
      daiPriceFeed.latestRoundData(),
      daiPriceFeed.decimals(),
      fetchOraclePrices(sdk, underlyingTokens)
    ]);

    const priceDataCache: TokenMap<BigNumber> = {};

    if (daiPriceData && daiPriceDecimals) {
      priceDataCache[getTokenIndex(tokens.DAI)] = getBNResult(
        daiPriceData.answer,
        daiPriceDecimals
      );
    }

    Object.values(oracleResults).forEach((result) => {
      const usd = result.usd;
      const twa = result.twa;
      const token = result.token;
      if (!token) return;

      priceDataCache[getTokenIndex(token)] = usd;
      priceDataCache[`${token.symbol}-TWA`] = twa;

      if (tokenIshEqual(token, tokens.WETH)) {
        priceDataCache[getTokenIndex(tokens.ETH)] = usd;
        priceDataCache[`ETH-TWA`] = twa;
      }
    });

    console.debug(
      `[beanstalk/tokenPrices/useCrvUnderlyingPrices] RESULT:`,
      priceDataCache
    );

    return priceDataCache;
  }, [hasEntries, daiPriceFeed, sdk, tokens]);

  const handleUpdatePrices = useCallback(async () => {
    const prices = await fetch();
    prices && dispatch(updateTokenPrices(prices));
  }, [dispatch, fetch]);

  useL2OnlyEffect(() => {
    handleUpdatePrices();
  }, []);

  return useMemo(() => ({ ...tokenPriceMap }), [tokenPriceMap]);
}

async function fetchOraclePrices(sdk: BeanstalkSDK, tokens: ERC20Token[]) {
  const beanstalk = sdk.contracts.beanstalk;
  const calls: AdvancedPipeStruct[] = tokens.map((token) => {
    const instantPriceCall: AdvancedPipeStruct = {
      target: beanstalk.address,
      callData: beanstalk.interface.encodeFunctionData('getTokenUsdPrice', [token.address]),
      clipboard: Clipboard.encode([]),
    };

    const twaPriceCall: AdvancedPipeStruct = {
      target: beanstalk.address,
      callData: beanstalk.interface.encodeFunctionData('getTokenUsdTwap', [token.address, 3600n]),
      clipboard: Clipboard.encode([]),
    };

    return [instantPriceCall, twaPriceCall];
  }).flat();

  const results = await beanstalk.callStatic.advancedPipe(calls, '0');

  const chunkedByToken = chunkArray(results, 2);

  return tokens.reduce<TokenMap<{
    usd: BigNumber;
    twa: BigNumber;
    token: ERC20Token;
  }>>((prev, token, i) => {
    const tokenChunk = chunkedByToken[i];

    const usd = beanstalk.interface.decodeFunctionResult('getTokenUsdPrice', tokenChunk[0])[0];
    const twa = beanstalk.interface.decodeFunctionResult('getTokenUsdTwap', tokenChunk[1])[0];

    prev[getTokenIndex(token)] = {
      usd: getBNResult(usd ?? "0", 6),
      twa: getBNResult(twa ?? "0", 6),
      token,
    };
    return prev;
  }, {});
}
