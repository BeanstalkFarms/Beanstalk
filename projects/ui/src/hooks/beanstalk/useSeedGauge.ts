import { useMemo } from 'react';
import { multicall } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { Token } from '@beanstalk/sdk';
import { BigNumber as BigNumberJS } from 'bignumber.js';
import { BigNumber as BigNumberEthers } from 'ethers';

import { AddressMap, ZERO_BN, ABISnippets } from '~/constants';
import { config } from '~/util/wagmi/config';
import { useAppSelector } from '~/state';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { toBNWithDecimals } from '~/util/BigNumber';

import useSdk from '~/hooks/sdk';
import useSeason from '~/hooks/beanstalk/useSeason';
import { ContractFunctionParameters } from 'viem';

interface BaseTokenSeedGaugeQueryInfo {
  /**
   * Optimal % of deposited BDV desired by the Gauge System
   */
  optimalPctDepositedBdv: BigNumberJS;
  /**
   * Current amount of GP allocated by the Gauge System
   */
  gaugePoints: BigNumberJS;
  /**
   * Gauge points per BDV
   */
  gaugePointsPerBdv: BigNumberJS;
  /**
   * Whether the whitelisted token is allocated gauge points by the gauge system
   */
  isAllocatedGP: boolean;
}

export interface TokenSeedGaugeInfo extends BaseTokenSeedGaugeQueryInfo {
  /**
   * the current percentage of all BDV deposited in the silo
   */
  currentPctDepositedBdv: BigNumberJS;
  /**
   * the total BDV deposited in the silo
   */
  totalBdv: BigNumberJS;
}

// custom toBignumber js function since we have to handle both ethers and bigint
const toBN = (
  n: BigInt | BigNumberEthers | number,
  decimalsOrToken: number | Token
) => {
  let nStr: string;

  if (typeof n === 'bigint' || typeof n === 'number') {
    nStr = n.toString();
  } else if (BigNumberEthers.isBigNumber(n)) {
    nStr = n.toString();
  } else {
    throw new Error('Invalid input type for "n" toBN');
  }

  const decimals =
    decimalsOrToken instanceof Token
      ? decimalsOrToken.decimals
      : decimalsOrToken;
  return toBNWithDecimals(nStr, decimals);
};

const getGPPerBdvPerTokenCalls = (
  address: string,
  tokens: Token[]
): ContractFunctionParameters<
  typeof ABISnippets.getGaugePointsPerBdvForToken
>[] =>
  tokens.map((token) => ({
    address: address as `0x{string}`,
    abi: ABISnippets.getGaugePointsPerBdvForToken,
    functionName: 'getGaugePointsPerBdvForToken',
    args: [token.address as `0x{string}`],
  }));

const MAX_BEAN_MAX_LP = toBN(LibCases.MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO, 18);

const MIN_BEAN_MAX_LP = toBN(LibCases.MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO, 18);

const useSeedGauge = () => {
  const sdk = useSdk();
  const season = useSeason();
  const siloBals = useAppSelector((s) => s._beanstalk.silo.balances);
  const siloLoading = !Object.keys(siloBals).length;
  const whitelist = [...sdk.tokens.siloWhitelist];

  const query = useQuery({
    queryKey: [
      [
        sdk.chainId.toString(),
        season.toString(),
        ...whitelist.map((t) => t.address),
      ],
      'beanstalk',
      'silo',
      'tokenSettings',
    ],
    queryFn: async () => {
      const b = sdk.contracts.beanstalk;
      const gaugeCalls = getGPPerBdvPerTokenCalls(b.address, whitelist);

      const [_bean2MaxLPRatio, gaugePointsPerBdvForToken, settings] =
        await Promise.all([
          b.getBeanToMaxLpGpPerBdvRatioScaled().catch(() => {
            console.debug(
              '[useSeedGauge/query]: Error fetching bean2MaxLPRatio for Seed Gauge'
            );
            return null;
          }),
          multicall(config, { contracts: gaugeCalls, allowFailure: true }),
          // BS3TODO: Fix me. For some reason utilizing multi call here returns 325n for optimalPercentDepositedBdv for every token
          Promise.all(whitelist.map((token) => b.tokenSettings(token.address))),
        ]);

      const map: AddressMap<BaseTokenSeedGaugeQueryInfo> = {};

      whitelist.forEach((token, i) => {
        const result = settings[i];
        const { error: gpErr, result: gpResult } = gaugePointsPerBdvForToken[i];

        const baseObj = {
          optimalPctDepositedBdv: ZERO_BN,
          gaugePoints: ZERO_BN,
          gaugePointsPerBdv: ZERO_BN,
          isAllocatedGP: false,
        };

        if (result) {
          const optimalPct = toBN(result.optimalPercentDepositedBdv, 6);

          map[token.address] = {
            ...baseObj,
            optimalPctDepositedBdv: optimalPct,
            gaugePoints: toBN(result.gaugePoints, 18),
            isAllocatedGP: optimalPct.gt(0),
          };
        } else {
          map[token.address] = {
            ...baseObj,
          };

          console.debug(
            `[useSeedGauge/query]: Error fetching token settings for ${token.symbol}`
          );
        }

        if (!gpErr && !!gpResult) {
          map[token.address].gaugePointsPerBdv = toBN(gpResult, 18);
        } else {
          console.debug(
            `[useSeedGauge/query]: Error getGaugePointsPerBdvForToken per BDV for ${token.symbol}`
          );
        }
      });

      const bean2MaxLPRatio = _bean2MaxLPRatio
        ? toBN(_bean2MaxLPRatio, 18)
        : ZERO_BN;

      return {
        tokenSettings: map,
        bean2MaxLPRatio,
      };
    },
    enabled: !!whitelist.length,
  });

  const gaugeData = useMemo(() => {
    if (!Object.keys(siloBals).length || !query.data?.tokenSettings) return {};
    const tokenSettingMap = query.data.tokenSettings;
    const map: AddressMap<TokenSeedGaugeInfo> = {};

    let totalRelevantBdv = ZERO_BN;

    Object.entries(tokenSettingMap).forEach(([address, values]) => {
      const bdvPerToken = siloBals[address]?.bdvPerToken || ZERO_BN;
      const totalDeposited = siloBals[address]?.deposited.amount || ZERO_BN;
      const tokenTotalBdv = bdvPerToken.times(totalDeposited);

      if (values.isAllocatedGP) {
        totalRelevantBdv = totalRelevantBdv.plus(tokenTotalBdv);
      }
      map[address] = {
        ...tokenSettingMap[address],
        totalBdv: tokenTotalBdv,
        currentPctDepositedBdv: ZERO_BN, // filler
      };
    });

    Object.entries(map).forEach(([key, value]) => {
      if (value.isAllocatedGP) {
        const currentPct = value.totalBdv.div(totalRelevantBdv).times(100); // scale amount to pct
        map[key].currentPctDepositedBdv = currentPct;
      }
    });

    return map;
  }, [query.data?.tokenSettings, siloBals]);

  return useMemo(
    () => ({
      data: {
        bean2MaxLPRatio: {
          max: MAX_BEAN_MAX_LP,
          value: query.data?.bean2MaxLPRatio,
          min: MIN_BEAN_MAX_LP,
        },
        gaugeData: gaugeData,
      },
      isLoading: siloLoading || query.isLoading,
      error: query.error,
      refetch: query.refetch,
    }),
    [
      gaugeData,
      query.data?.bean2MaxLPRatio,
      query.error,
      query.isLoading,
      query.refetch,
      siloLoading,
    ]
  );
};

export default useSeedGauge;

// console.log(
//   'tokenSettings: ',
//   Object.entries(map).reduce<Record<string, any>>((prev, curr) => {
//     const [key, value] = curr;

//     prev[key] = {
//       gaugePoints: value.gaugePoints.toNumber(),
//       gaugePointsPerBdv: value.gaugePointsPerBdv.toNumber(),
//       isAllocatedGP: value.isAllocatedGP,
//       optimalPctDepositedBdv: value.optimalPctDepositedBdv.toNumber(),
//     };

//     return prev;
//   }, {})
// );
