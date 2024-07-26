import { multicall } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { AddressMap, ZERO_BN } from '~/constants';
import { Token, TokenValue } from '@beanstalk/sdk';
import { config } from '~/util/wagmi/config';
import { BigNumber as BigNumberJS } from 'bignumber.js';
import { BigNumber as BigNumberEthers } from 'ethers';
import { useAppSelector } from '~/state';
import { useMemo } from 'react';
import { cloneDeep } from 'lodash';
import useSdk from '../sdk';

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

export type BaseTokenSeedGaugeQueryInfo = {
  optimalPercentDepositedBdv: BigNumberJS;
  gaugePoints: BigNumberJS;
  gaugePointsPerBdv: BigNumberJS;
};

export type TokenSeedGaugeInfo = {
  currentPercentDepositedBdv: BigNumberJS;
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

const gaugePointsAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'getGaugePointsPerBdvForToken',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const abi = [
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'tokenSettings',
    outputs: [
      {
        components: [
          { internalType: 'bytes4', name: 'selector', type: 'bytes4' },
          {
            internalType: 'uint32',
            name: 'stalkEarnedPerSeason',
            type: 'uint32',
          },
          { internalType: 'uint32', name: 'stalkIssuedPerBdv', type: 'uint32' },
          { internalType: 'uint32', name: 'milestoneSeason', type: 'uint32' },
          { internalType: 'int96', name: 'milestoneStem', type: 'int96' },
          { internalType: 'bytes1', name: 'encodeType', type: 'bytes1' },
          {
            internalType: 'int24',
            name: 'deltaStalkEarnedPerSeason',
            type: 'int24',
          },
          { internalType: 'bytes4', name: 'gpSelector', type: 'bytes4' },
          { internalType: 'bytes4', name: 'lwSelector', type: 'bytes4' },
          { internalType: 'uint128', name: 'gaugePoints', type: 'uint128' },
          {
            internalType: 'uint64',
            name: 'optimalPercentDepositedBdv',
            type: 'uint64',
          },
        ],
        internalType: 'struct Storage.SiloSettings',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const makeContractCalls = (beanstalkAddress: string, tokens: Token[]) =>
  tokens.map((token) => ({
    address: beanstalkAddress as `0x{string}`,
    abi: abi,
    functionName: 'tokenSettings',
    args: [token.address],
  }));

const gaugePointsPerBdvPerTokenCalls = (
  beanstalkAddress: string,
  tokens: Token[]
) =>
  tokens.map((token) => ({
    address: beanstalkAddress as `0x{string}`,
    abi: gaugePointsAbi,
    functionName: 'getGaugePointsPerBdvForToken',
    args: [token.address],
  }));

const useSeedGauge = () => {
  const sdk = useSdk();
  const siloBals = useAppSelector((s) => s._beanstalk.silo.balances);
  const siloLoading = !Object.keys(siloBals).length;

  const whitelist = [...sdk.tokens.siloWhitelist];

  const query = useQuery({
    queryKey: ['beanstalk', 'silo', 'beanstalkSiloTokenSettings'],
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

      const map: AddressMap<TokenSeedGaugeInfo> = {};

      whitelist.forEach((token, i) => {
        const result = settings[i];
        if (!result.error && result.result) {
          const r = result.result;
          map[token.address] = {
            optimalPercentDepositedBdv: toBN(r.optimalPercentDepositedBdv, 6),
            gaugePoints: toBN(r.gaugePoints, 18),
            gaugePointsPerBdv: ZERO_BN, // filler
            currentPercentDepositedBdv: ZERO_BN, // filler
            totalBdv: ZERO_BN, // filler
          };
        }

        const gpResult = gaugePointsPerBdvForToken[i];
        if (!gpResult.error && result.result && token.symbol !== 'BEAN') {
          map[token.address].gaugePointsPerBdv = toBN(gpResult.result, 18);
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

  const tokenSettings = useMemo(() => {
    if (!Object.keys(siloBals).length || !query.data?.tokenSettings) return {};

    // Deep clone to avoid mutating the query data
    const tokenSettingMap = cloneDeep(query.data.tokenSettings);

    let totalRelevantBdv = ZERO_BN;

    Object.entries(tokenSettingMap).forEach(([address, values]) => {
      const bdvPerToken = siloBals[address].bdvPerToken || ZERO_BN;
      const totalDeposited = siloBals[address].deposited.amount || ZERO_BN;
      const tokenTotalBdv = bdvPerToken.times(totalDeposited);

      if (values.gaugePoints.gt(0)) {
        totalRelevantBdv = totalRelevantBdv.plus(tokenTotalBdv);
      }
      tokenSettingMap[address].totalBdv = tokenTotalBdv;
    });

    Object.entries(tokenSettingMap).forEach(([key, value]) => {
      if (value.gaugePoints.gt(0)) {
        tokenSettingMap[key].currentPercentDepositedBdv = value.totalBdv
          .div(totalRelevantBdv)
          .times(100); // scale amount to pct
      }
    });

    return tokenSettingMap;
  }, [query?.data?.tokenSettings, siloBals]);

  return {
    data: {
      maxBean2LPRatio: query.data?.maxBean2LPRatio,
      tokenSettings,
    },
    isLoading: siloLoading || query.isLoading,
  };
};

export default useSeedGauge;
