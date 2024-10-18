import { DocumentNode, QueryOptions } from '@apollo/client';
import {
  BEANSTALK_ADDRESSES,
  REPLANT_SEASON,
  RESEED_SEASON,
  SupportedChainId,
} from '~/constants';
import {
  SeasonalDepositedSiloAssetDocument,
  SeasonalInstantPriceDocument,
  SeasonalTokenChopRateDocument,
} from '~/generated/graphql';
import { getMultiChainToken, TokenInstance } from '~/hooks/beanstalk/useTokens';

// ==========================================================
// Query Keys
// ==========================================================
// prettier-ignore
export const subgraphQueryKeys = {
  // ----------------------- Bean ------------------------
  priceInstantBEAN: 'seasonalInstantPrice',
  volumeBEAN: 'seasonalVolume-BEAN',
  totalLiquidityBEAN: 'seasonalTotalLiquidity-BEAN',
  marketCapBEAN: 'seasonalMarketCap-BEAN',
  supplyBEAN: 'seasonalSupply-BEAN',
  crossesBEAN: 'seasonalCrosses-BEAN',
  instantaneousDeltaBBEAN: 'seasonalInstantaneousDeltaB-BEAN',
  twaDeltaBBEAN: 'seasonalTWADeltaB-BEAN',
  twaPriceBEAN: 'seasonalTWAPrice-BEAN',
  l2srBEAN: 'seasonalL2SR-BEAN',

  // Token
  tokenLiquidity: (token: TokenInstance) => ['seasonalTokenLiquidity', token.symbol].join("-"),

  // --------------------- Beanstalk ---------------------
  // ------ Beanstalk Silo ------
  beanstalkTotalStalk: 'seasonalBeanstalkTotalStalk',
  beanstalkRRoR: 'seasonalBeanstalkRRoR',
  depositedSiloToken: (token: TokenInstance) => ['seasonalSiloTokenDeposited', token.symbol].join("-"),
  siloToken30DvAPY: (
    token: TokenInstance | string
  ) => ['seasonal30DvAPY', typeof token === 'string' ? token : token.symbol].join("-"),

  // Unripe
  seasonalChopRate: (token: TokenInstance) => ['seasonalTokenChopRate', token.symbol].join("-"),

  // ----- Field -----
  beanstalkMaxTemperature: 'seasonalBeanstalkMaxTemperature',
  beanstalkUnharvestablePods: 'seasonalBeanstalkUnharvestablePods',
  beanstalkPodRate: 'seasonalBeanstalkPodRate',
  beanstalkSownBeans: 'seasonalBeanstalkSownBeans',
  beanstalkHarvestedPods: 'seasonalBeanstalkHarvestedPods',
  beanstalkTotalSowers: 'seasonalBeanstalkTotalSowers',
  beanstalkTotalSeeds: 'seasonalBeanstalkTotalSeeds',
  
  // ------ Farmer Silo ------
  farmerSiloRewards: (account: string | undefined) => ['farmerSiloRewards', account ?? "no-account"].join("-"),
  farmerSiloAssetSnapshots: (account: string | undefined) => ['farmerSiloAssetSnapshots', account ?? "no-account"].join("-"),
}

// ==========================================================
// Types & Interfaces
// ==========================================================
export type EvmLayer = 'l1' | 'l2';

export type DynamicSGQueryOption = (subgraph: EvmLayer) => Partial<QueryOptions>;

export type DynamicSGQueryOptionFunction = (...args: any[]) => Partial<QueryOptions>;

interface SGQueryConfig<
  T extends DynamicSGQueryOption | DynamicSGQueryOptionFunction = DynamicSGQueryOption,
> {
  document: DocumentNode;
  queryKey: string;
  queryOptions: T;
}

// ==========================================================
// Constants
// ==========================================================
const beanstalkETH = BEANSTALK_ADDRESSES[SupportedChainId.ETH_MAINNET];

const beanstalkARB = BEANSTALK_ADDRESSES[SupportedChainId.ARBITRUM_MAINNET];

const RESEED_SEASON_TIMESTAMP = 1728525600;


// ==========================================================
// Dynamic SG Query Options
// ==========================================================
const getSeasonalInstantOptions: DynamicSGQueryOption = (chain) => {
  const options = {
    query: SeasonalInstantPriceDocument,
    variables: { season_gt: RESEED_SEASON - 1 },
    context: { subgraph: 'bean' },
  };

  if (chain === 'l1') {
    options.variables.season_gt = 0;
    options.context.subgraph = 'bean_eth';
  }

  return options;
};
const getSeasonalUnripeChopRateOptions =
  (address: string): DynamicSGQueryOption =>
  (chain) => {
    const tokens = getMultiChainToken(address);
    const options = {
      query: SeasonalTokenChopRateDocument,
      variables: {
        season_gt: RESEED_SEASON - 1,
        token: tokens.arb.address.toLowerCase(),
      },
      context: { subgraph: 'beanstalk' },
    };

    if (chain === 'l1') {
      options.variables.season_gt = REPLANT_SEASON - 1;
      options.variables.token = tokens.eth.address.toLowerCase();
      options.context.subgraph = 'beanstalk_eth';
    }

    return options;
  };
const depositedSiloTokenOptions = (token: TokenInstance): DynamicSGQueryOption => {
  const tkn = getMultiChainToken(token.address);
  return (chain) => {
    const options = {
      variables: {
        season_gt: RESEED_SEASON - 1,
        siloAsset: `${beanstalkARB}-${tkn.arb.address}`,
      },
      context: { subgraph: 'beanstalk' },
    };
    if (chain === 'l1') {
      options.variables.season_gt = REPLANT_SEASON - 1;
      options.variables.siloAsset = `${beanstalkETH}-${tkn.eth.address}`;
      options.context = { subgraph: 'beanstalk_eth' };
    }
    return options;
  };
};

// prettier-ignore
export const subgraphQueryConfigs = {
  // ----------------------- Bean ------------------------
  priceInstantBEAN: {
    document: SeasonalInstantPriceDocument,
    queryKey: subgraphQueryKeys.priceInstantBEAN,
    queryOptions: getSeasonalInstantOptions,
  } satisfies SGQueryConfig<DynamicSGQueryOption>,

  // --------------------- Beanstalk ---------------------

  // ------ Silo ------
  depositedSiloToken: (token: TokenInstance): SGQueryConfig<DynamicSGQueryOption> => ({
    document: SeasonalDepositedSiloAssetDocument,
    queryKey: subgraphQueryKeys.depositedSiloToken(token),
    queryOptions: depositedSiloTokenOptions(token),
  }),

  // Unripe
  seasonalChopRate: (token: TokenInstance): SGQueryConfig<DynamicSGQueryOption> => ({
    document: SeasonalTokenChopRateDocument,
    queryKey: subgraphQueryKeys.seasonalChopRate(token),
    queryOptions: getSeasonalUnripeChopRateOptions(token.address),
  }),
};

// ==========================================================
// Utility Functions
// ==========================================================
type BinarySearchAccessor<T> = T extends number ? never : (a: T) => number;

/**
 * Binary search function for some data that has a season field
 * @param array - The array to search
 * @param target - The target season
 * @param compare - The comparison function to compare seasons
 * @param accessor - The accessor function to get the season from data
 * @returns The index of the target season
 */
export function binarySearchSeasons<T>(
  array: T[],
  target: number,
  compare: (a: number, b: number) => number,
  accessor?: BinarySearchAccessor<T>
): number {
  let low = 0;
  let high = array.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value =
      typeof array[mid] !== 'number' && accessor
        ? accessor(array[mid])
        : (array[mid] as number);
    const cmp = compare(value, target);

    if (cmp === 0) {
      return mid;
    }
    if (cmp < 0) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return high;
}

/**
 * Get the difference in seconds between now and the last reseed season
 * @returns The difference in seconds
 */
function getNow2ReseedSeasonsDiff() {
  const now = Math.floor(new Date().getTime() / 1000);
  const secondsDiff = now - RESEED_SEASON_TIMESTAMP;

  return Math.floor(secondsDiff / 60 / 60);
}
