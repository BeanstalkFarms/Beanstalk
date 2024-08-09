import { multicall } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { AddressMap, ZERO_BN, ABISnippets } from '~/constants';
import { Token } from '@beanstalk/sdk';
import { config } from '~/util/wagmi/config';
import { BigNumber as BigNumberJS } from 'bignumber.js';
import { BigNumber as BigNumberEthers } from 'ethers';
import { useAppSelector } from '~/state';
import { useMemo } from 'react';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { toBNWithDecimals } from '~/util/BigNumber';
import useSdk from '../sdk';
import useSeason from './useSeason';

type BaseTokenSeedGaugeQueryInfo = {
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
};

export type TokenSeedGaugeInfo = {
  /**
   * the current percentage of all BDV deposited in the silo
   */
  currentPctDepositedBdv: BigNumberJS;
  /**
   * the total BDV deposited in the silo
   */
  totalBdv: BigNumberJS;
} & BaseTokenSeedGaugeQueryInfo;

// custom toBignumber js function since we have to handle both ethers and bigint
const toBN = (
  n: BigInt | BigNumberEthers | number,
  decimalsOrToken: number | Token
) => {
  const decimals =
    decimalsOrToken instanceof Token
      ? decimalsOrToken.decimals
      : decimalsOrToken;

  return toBNWithDecimals(n.toString(), decimals);
};

const getTokenSettingsCalls = (address: string, tokens: Token[]) =>
  tokens.map((token) => ({
    address: address as `0x{string}`,
    abi: ABISnippets.tokenSettings,
    functionName: 'tokenSettings',
    args: [token.address],
  }));

const getGPPerBdvPerTokenCalls = (address: string, tokens: Token[]) =>
  tokens.map((token) => ({
    address: address as `0x{string}`,
    abi: ABISnippets.getGaugePointsPerBdvForToken,
    functionName: 'getGaugePointsPerBdvForToken',
    args: [token.address],
  }));

const useSeedGauge = () => {
  const sdk = useSdk();
  const season = useSeason();
  const siloBals = useAppSelector((s) => s._beanstalk.silo.balances);
  const siloLoading = !Object.keys(siloBals).length;
  const whitelist = [...sdk.tokens.siloWhitelist];

  const query = useQuery({
    queryKey: ['beanstalk', 'silo', 'tokenSettings', season.toString()],
    queryFn: async () => {
      const b = sdk.contracts.beanstalk;

      const calls = getTokenSettingsCalls(b.address, whitelist);
      const gaugeCalls = getGPPerBdvPerTokenCalls(b.address, whitelist);

      const [_bean2MaxLPRatio, settings, gaugePointsPerBdvForToken] =
        await Promise.all([
          b.getBeanToMaxLpGpPerBdvRatioScaled(),
          multicall(config, { contracts: calls }),
          multicall(config, { contracts: gaugeCalls }),
        ]);

      const map: AddressMap<BaseTokenSeedGaugeQueryInfo> = {};

      whitelist.forEach((token, i) => {
        const { error: err, result } = settings[i];
        const { error: gpErr, result: gpResult } = gaugePointsPerBdvForToken[i];

        if (!err && !!result) {
          const optimalPct = toBN(result.optimalPercentDepositedBdv, 6);

          map[token.address] = {
            optimalPctDepositedBdv: optimalPct,
            gaugePoints: toBN(result.gaugePoints, 18),
            gaugePointsPerBdv: ZERO_BN,
            isAllocatedGP: optimalPct.gt(0),
          };
        }

        if (!gpErr && !!gpResult) {
          map[token.address].gaugePointsPerBdv = toBN(gpResult, 18);
        }
      });

      const bean2MaxLPRatio = toBN(_bean2MaxLPRatio, 18);

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
      const bdvPerToken = siloBals[address].bdvPerToken || ZERO_BN;
      const totalDeposited = siloBals[address].deposited.amount || ZERO_BN;
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

  return {
    data: {
      bean2MaxLPRatio: {
        max: toBN(LibCases.MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO, 18),
        value: query.data?.bean2MaxLPRatio,
        min: toBN(LibCases.MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO, 18),
      },
      gaugeData: gaugeData,
    },
    isLoading: siloLoading || query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useSeedGauge;
