import { useCallback, useMemo } from 'react';
import { Token } from '@beanstalk/sdk';
import { BigNumber } from 'bignumber.js';
import { useDispatch } from 'react-redux';
import { ContractFunctionParameters } from 'viem';

import { useAggregatorV3Contract } from '~/hooks/ledger/useContract';
import { updateTokenPrices } from '~/state/beanstalk/tokenPrices/actions';
import { chunkArray, bigNumberResult, getTokenIndex } from '~/util';
import BEANSTALK_ABI_SNIPPETS from '~/constants/abi/Beanstalk/abiSnippets';
import { TokenMap } from '~/constants/index';
import { DAI_CHAINLINK_ADDRESSES } from '~/constants/addresses';
import { useAppSelector } from '~/state/index';
import useSdk from '~/hooks/sdk';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import { extractMulticallResult } from '~/util/Multicall';

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
  const beanstalk = sdk.contracts.beanstalk;

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

    const calls = makeMultiCall(beanstalk.address, underlyingTokens);

    const [daiPriceData, daiPriceDecimals, oracleResults] = await Promise.all([
      daiPriceFeed.latestRoundData(),
      daiPriceFeed.decimals(),
      Promise.all(
        calls.contracts.map((oracleCalls) =>
          multicall(config, { contracts: oracleCalls })
        )
      ).then((results) => chunkArray(results.flat(), calls.chunkSize)),
    ]);

    const priceDataCache: TokenMap<BigNumber> = {};

    if (daiPriceData && daiPriceDecimals) {
      priceDataCache[getTokenIndex(tokens.DAI)] = getBNResult(
        daiPriceData.answer,
        daiPriceDecimals
      );
    }

    oracleResults.forEach((result, index) => {
      const price = extractMulticallResult(result[0]);
      const twap = extractMulticallResult(result[1]);
      const token = underlyingTokens[index];
      if (!token) return;

      // BS3TODO: REMOVE ME
      const decimals = ['wstETH', 'weETH'].includes(token.symbol) ? 40 : 6;
      // BS3TODO: REMOVE ME
      const divBy = ['wstETH', 'weETH'].includes(token.symbol) ? 20000 : 1;

      if (price) {
        priceDataCache[getTokenIndex(token)] = getBNResult(
          price.toString(),
          decimals
        ).div(divBy);
      }
      if (twap) {
        priceDataCache[`${token.symbol}-TWA`] = getBNResult(
          twap.toString(),
          decimals
        ).div(divBy);
      }

      // add it for ETH as well
      if (token.equals(tokens.WETH)) {
        priceDataCache[getTokenIndex(tokens.ETH)] =
          priceDataCache[getTokenIndex(tokens.WETH)];
        priceDataCache[`ETH-TWA`] = priceDataCache[`${token.symbol}-TWA`];
      }
    });

    console.debug(
      `[beanstalk/tokenPrices/useCrvUnderlyingPrices] RESULT:`,
      priceDataCache
    );

    return priceDataCache;
  }, [hasEntries, daiPriceFeed, beanstalk, tokens]);

  const handleUpdatePrices = useCallback(async () => {
    const prices = await fetch();
    prices && dispatch(updateTokenPrices(prices));
  }, [dispatch, fetch]);

  useL2OnlyEffect(() => {
    handleUpdatePrices();
  }, []);

  return useMemo(() => ({ ...tokenPriceMap }), [tokenPriceMap]);
}

type OraclePriceCall = ContractFunctionParameters<
  typeof BEANSTALK_ABI_SNIPPETS.oraclePrices
>;
function makeMultiCall(beanstalkAddress: string, tokens: Token[]) {
  const calls: OraclePriceCall[] = [];

  const contract = {
    address: beanstalkAddress as `0x${string}`,
    abi: BEANSTALK_ABI_SNIPPETS.oraclePrices,
  };

  let address: `0x${string}` = '0x';

  for (const token of tokens) {
    address = token.address as `0x${string}`;
    const instantPriceCall: OraclePriceCall = {
      ...contract,
      functionName: 'getTokenUsdPrice',
      args: [address as `0x${string}`],
    };
    const twapPriceCall: OraclePriceCall = {
      ...contract,
      functionName: 'getTokenUsdTwap',
      args: [address as `0x${string}`, 3600n],
    };

    calls.push(instantPriceCall, twapPriceCall);
  }

  return {
    contracts: chunkArray(calls, 20),
    chunkSize: 2,
  };
}
