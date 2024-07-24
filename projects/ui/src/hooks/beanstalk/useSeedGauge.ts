import { multicall } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { AddressMap, ZERO_BN } from '~/constants';
import { Token, TokenValue } from '@beanstalk/sdk';
import { config } from '~/util/wagmi/config';
import BigNumber from 'bignumber.js';
import useSdk from '../sdk';

export type TokenSettingMap = AddressMap<{
  optimalPercentDepositedBdv: BigNumber;
  gaugePoints: BigNumber;
}>;

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

const useSeedGauge = () => {
  const sdk = useSdk();

  const whitelist = [...sdk.tokens.siloWhitelist];

  return useQuery({
    queryKey: ['beanstalk', 'silo', 'beanstalkSiloTokenSettings'],
    queryFn: async () => {
      const calls = makeContractCalls(
        sdk.contracts.beanstalk.address,
        whitelist
      );

      const [_maxBean2LPRatio, settings] = await Promise.all([
        sdk.contracts.beanstalk.getBeanToMaxLpGpPerBdvRatioScaled(),
        multicall(config, { contracts: calls }),
      ]);

      const tokenSettings = whitelist.reduce<TokenSettingMap>(
        (prev, curr, i) => {
          const result = settings[i];
          if (result.error || !result.result) return prev;
          const r = result.result;

          const optimalPct = new BigNumber(
            TokenValue.fromBlockchain(r.optimalPercentDepositedBdv, 6).toHuman()
          );
          const gaugePoints = new BigNumber(
            TokenValue.fromBlockchain(r.gaugePoints, 18).toHuman()
          );
          prev[curr.address] = {
            optimalPercentDepositedBdv: optimalPct,
            gaugePoints: gaugePoints,
          };
          return prev;
        },
        {}
      );

      const maxBean2LPRatio = new BigNumber(
        TokenValue.fromBlockchain(_maxBean2LPRatio, 18).toHuman()
      );

      return {
        tokenSettings,
        maxBean2LPRatio,
      };
    },
    placeholderData: {
      tokenSettings: {},
      maxBean2LPRatio: ZERO_BN,
    },
    enabled: !!whitelist.length,
  });
};

export default useSeedGauge;
