import { multicall } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { AddressMap, ZERO_BN, ABISnippets } from '~/constants';
import { Token, TokenValue } from '@beanstalk/sdk';
import { config } from '~/util/wagmi/config';
import { BigNumber as BigNumberJS } from 'bignumber.js';
import { BigNumber as BigNumberEthers } from 'ethers';
import { useAppSelector } from '~/state';
import { useMemo } from 'react';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import useSdk from '../sdk';
import { toBNWithDecimals } from '../../util/BigNumber';
import useSeason from './useSeason';

export type SiloTokenSettingMap = AddressMap<{
  stalkedEarnedPerSeason: BigNumberJS;
  stalkIssuedPerBdv: BigNumberJS;
  milestoneStem: BigNumberJS;
  deltaStalkEarnedPerSeason: BigNumberJS;
  gaugePoints: BigNumberJS;
  optimalPercentDepositedBdv: BigNumberJS;
  currentPercentDepositedBdv: BigNumberJS;
  gaugePointsPerBdv: BigNumberJS;
  totalBdv: BigNumberJS;
}>;

type BaseTokenSeedGaugeQueryInfo = {
  optimalPctDepositedBdv: BigNumberJS;
  gaugePoints: BigNumberJS;
  gaugePointsPerBdv: BigNumberJS;
};

export type TokenSeedGaugeInfo = {
  currentPctDepositedBdv: BigNumberJS;
  totalBdv: BigNumberJS;
} & BaseTokenSeedGaugeQueryInfo;

const toBN = (
  n: BigInt | BigNumberEthers | number,
  decimalsOrToken: number | Token
) => {
  const decimals =
    decimalsOrToken instanceof Token
      ? decimalsOrToken.decimals
      : decimalsOrToken;
  return BigNumberJS(TokenValue.fromBlockchain(n, decimals).toHuman());
};

const makeContractCalls = (beanstalkAddress: string, tokens: Token[]) =>
  tokens.map((token) => ({
    address: beanstalkAddress as `0x{string}`,
    abi: ABISnippets.tokenSettings,
    functionName: 'tokenSettings',
    args: [token.address],
  }));

const gaugePointsPerBdvPerTokenCalls = (
  beanstalkAddress: string,
  tokens: Token[]
) =>
  tokens.map((token) => ({
    address: beanstalkAddress as `0x{string}`,
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
    queryKey: [
      'beanstalk',
      'silo',
      'beanstalkSiloTokenSettings',
      season.toString(),
    ],
    queryFn: async () => {
      const calls = makeContractCalls(
        sdk.contracts.beanstalk.address,
        whitelist
      );
      const gaugeCalls = gaugePointsPerBdvPerTokenCalls(
        sdk.contracts.beanstalk.address,
        whitelist
      );

      const [_maxBean2LPRatio, settings, gaugePointsPerBdvForToken] =
        await Promise.all([
          sdk.contracts.beanstalk.getBeanToMaxLpGpPerBdvRatioScaled(),
          multicall(config, { contracts: calls }),
          multicall(config, { contracts: gaugeCalls }),
        ]);

      const map: AddressMap<BaseTokenSeedGaugeQueryInfo> = {};

      whitelist.forEach((token, i) => {
        const { error: err, result } = settings[i];
        const { error: gpErr, result: gpResult } = gaugePointsPerBdvForToken[i];

        if (!err && !!result) {
          map[token.address] = {
            optimalPctDepositedBdv: toBN(result.optimalPercentDepositedBdv, 6),
            gaugePoints: toBN(result.gaugePoints, 18),
            gaugePointsPerBdv: ZERO_BN,
          };
        }

        if (!gpErr && !!gpResult) {
          map[token.address].gaugePointsPerBdv = toBN(gpResult, 18);
        }
      });

      const maxBean2LPRatio = toBN(_maxBean2LPRatio, 18);

      return {
        tokenSettings: map,
        maxBean2LPRatio,
      };
    },

    enabled: !!whitelist.length,
  });

  // console.log('query: ', query.data);

  const gaugeData = useMemo(() => {
    if (!Object.keys(siloBals).length || !query.data?.tokenSettings) return {};

    const tokenSettingMap = query.data.tokenSettings;

    const map: AddressMap<TokenSeedGaugeInfo> = {};

    let totalRelevantBdv = ZERO_BN;

    Object.entries(tokenSettingMap).forEach(([address, values]) => {
      const bdvPerToken = siloBals[address].bdvPerToken || ZERO_BN;
      const totalDeposited = siloBals[address].deposited.amount || ZERO_BN;
      const tokenTotalBdv = bdvPerToken.times(totalDeposited);

      if (values.gaugePoints.gt(0)) {
        totalRelevantBdv = totalRelevantBdv.plus(tokenTotalBdv);
      }
      map[address] = {
        ...tokenSettingMap[address],
        totalBdv: tokenTotalBdv,
        currentPctDepositedBdv: ZERO_BN, // filler
      };
    });

    Object.entries(map).forEach(([key, value]) => {
      if (value.gaugePoints.gt(0) && key !== sdk.tokens.BEAN.address) {
        const currentPct = value.totalBdv.div(totalRelevantBdv).times(100); // scale amount to pct
        map[key].currentPctDepositedBdv = currentPct;
      }
    });

    return map;
  }, [query?.data?.tokenSettings, siloBals, sdk]);

  // console.log('gaugeData: ', gaugeData);

  return {
    data: {
      bean2MaxLPRatio: {
        max: toBNWithDecimals(LibCases.MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO, 18),
        value: query.data?.maxBean2LPRatio,
        min: toBNWithDecimals(LibCases.MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO, 18),
      },
      gaugeData: gaugeData,
    },
    isLoading: siloLoading || query.isLoading,
  };
};

export default useSeedGauge;
