import { multicall } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { AddressMap, ZERO_BN } from '~/constants';
import { Token, TokenValue } from '@beanstalk/sdk';
import { config } from '~/util/wagmi/config';
import { BigNumber as BigNumberJS } from 'bignumber.js';
import { BigNumber as BigNumberEthers } from 'ethers';
import useSdk from '../sdk';

export type SiloTokenSettingMap = AddressMap<{
  stalkedEarnedPerSeason: BigNumberJS;
  stalkIssuedPerBdv: BigNumberJS;
  milestoneStem: BigNumberJS;
  deltaStalkEarnedPerSeason: BigNumberJS;
  gaugePoints: BigNumberJS;
  optimalPercentDepositedBdv: BigNumberJS;
}>;

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

  const stalk = sdk.tokens.STALK;

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

      const map: SiloTokenSettingMap = {};

      const displayMap: any = {};

      whitelist.forEach((token, i) => {
        const result = settings[i];
        if (result.error || !result.result) return;
        const r = result.result;

        map[token.address] = {
          optimalPercentDepositedBdv: toBN(r.optimalPercentDepositedBdv, 6),
          stalkIssuedPerBdv: toBN(r.stalkIssuedPerBdv, stalk.decimals),
          stalkedEarnedPerSeason: toBN(r.stalkIssuedPerBdv, stalk.decimals),
          milestoneStem: toBN(r.milestoneStem, 0),
          gaugePoints: toBN(r.gaugePoints, 18),
          deltaStalkEarnedPerSeason: toBN(r.deltaStalkEarnedPerSeason, 0),
        };

        const m = map[token.address];
        displayMap[token.symbol] = {
          optimalPercentDepositedBdv: m.optimalPercentDepositedBdv?.toNumber(),
          stalkIssuedPerBdv: m?.stalkIssuedPerBdv?.toNumber(),
          stalkedEarnedPerSeason: m.stalkedEarnedPerSeason?.toNumber(),
          milestoneStem: m.milestoneStem?.toNumber(),
          gaugePoints: m.gaugePoints?.toNumber(),
          deltaStalkEarnedPerSeason: m.deltaStalkEarnedPerSeason?.toNumber(),
        };
      });

      console.log('displaydata: ', displayMap);

      const maxBean2LPRatio = toBN(_maxBean2LPRatio, 18);

      return {
        tokenSettings: map,
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
