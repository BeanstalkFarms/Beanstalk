const getGaugePointsPerBdvForToken = [
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

const tokenSettings = [
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

const BEANSTALK_ABI_SNIPPETS = {
  getGaugePointsPerBdvForToken: getGaugePointsPerBdvForToken,
  tokenSettings: tokenSettings,
} as const;

export default BEANSTALK_ABI_SNIPPETS;
