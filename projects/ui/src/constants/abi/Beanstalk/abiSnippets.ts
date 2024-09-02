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

const poolDeltaB = [
  {
    inputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
    name: 'poolDeltaB',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Snippets of select view functions from the SiloGettersFacet.sol.
 * - bdv
 * - totalStalk
 * - totalRoots
 * - totalEarnedBeans
 * - getTotalDeposited
 * - getTotalDepositedBdv
 * - getGerminatingTotalDeposited
 * - balanceOfEarnedBeans
 * - balanceOfStalk
 * - balanceOfGrownStalk
 * - balanceOfGrownStalkMultiple
 */
const siloGetters = [
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'bdv',
    outputs: [{ internalType: 'uint256', name: '_bdv', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalStalk',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalRoots',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalEarnedBeans',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'getTotalDeposited',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'getTotalDepositedBdv',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'getGerminatingTotalDeposited',
    outputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOfRoots',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address[]', name: 'tokens', type: 'address[]' },
    ],
    name: 'getMowStatus',
    outputs: [
      {
        components: [
          { internalType: 'int96', name: 'lastStem', type: 'int96' },
          { internalType: 'uint128', name: 'bdv', type: 'uint128' },
        ],
        internalType: 'struct MowStatus[]',
        name: 'mowStatuses',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOfEarnedBeans',
    outputs: [{ internalType: 'uint256', name: 'beans', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOfStalk',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'balanceOfGrownStalk',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address[]', name: 'tokens', type: 'address[]' },
    ],
    name: 'balanceOfGrownStalkMultiple',
    outputs: [
      { internalType: 'uint256[]', name: 'grownStalks', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const BEANSTALK_ABI_SNIPPETS = {
  getGaugePointsPerBdvForToken: getGaugePointsPerBdvForToken,
  tokenSettings: tokenSettings,
  poolDeltaB: poolDeltaB,
  siloGetters: siloGetters,
} as const;

export default BEANSTALK_ABI_SNIPPETS;

// getDeposit
// getTotalDeposited
// getTotalSiloDeposited
// getTotalDepositedBdv
// getTotalSiloDepositedBdv
// getGerminatingTotalDeposited
// getGerminatingTotalDepositedBdv
// tokenSettings
// balanceOf
// balanceOfBatch
// getDepositId
// bdv
// bdvs
// lastUpdate
// totalStalk
// getGerminatingStalkAndRootsForSeason
// getGerminatingStalkForSeason
// getGerminatingRootsForSeason
// getTotalGerminatingStalk
// getYoungAndMatureGerminatingTotalStalk
// getTotalGerminatingAmount
// getTotalGerminatingBdv
// getOddGerminating
// getEvenGerminating
// balanceOfFinishedGerminatingStalkAndRoots
// totalRoots
// totalEarnedBeans
// balanceOfStalk
// balanceOfGerminatingStalk
// balanceOfYoungAndMatureGerminatingStalk
// balanceOfRoots
// balanceOfGrownStalk
// balanceOfGrownStalkMultiple
// grownStalkForDeposit
// balanceOfEarnedBeans
// balanceOfEarnedStalk
// balanceOfPlantableSeeds
// stalkEarnedPerSeason
// balanceOfDepositedBdv
// getLastMowedStem
// getMowStatus
// lastSeasonOfPlenty
// balanceOfPlenty
// balanceOfRainRoots
// balanceOfSop
// totalRainRoots
// stemTipForToken
// getStemTips
// calculateStemForTokenFromGrownStalk
// getGerminatingStem
// getGerminatingStems
// getDepositsForAccount
// getDepositsForAccount
// getTokenDepositsForAccount
// getTokenDepositIdsForAccount
// getIndexForDepositId
// getBeanIndex
// getNonBeanTokenAndIndexFromWell
// getBeanstalkTokens
