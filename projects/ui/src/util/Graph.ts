import { DocumentNode, QueryOptions } from '@apollo/client';
import {
  BEANSTALK_ADDRESSES,
  REPLANT_SEASON,
  RESEED_SEASON,
  SupportedChainId,
} from '~/constants';
import {
  LiquiditySupplyRatioDocument,
  SeasonalApyDocument,
  SeasonalCrossesDocument,
  SeasonalDepositedSiloAssetDocument,
  SeasonalHarvestedPodsDocument,
  SeasonalInstantDeltaBDocument,
  SeasonalInstantPriceDocument,
  SeasonalLiquidityDocument,
  SeasonalLiquidityPerPoolDocument,
  SeasonalMarketCapDocument,
  SeasonalPodRateDocument,
  SeasonalPodsDocument,
  SeasonalRRoRDocument,
  SeasonalSownDocument,
  SeasonalStalkDocument,
  SeasonalSupplyDocument,
  SeasonalTemperatureDocument,
  SeasonalTokenChopRateDocument,
  SeasonalTotalSowersDocument,
  SeasonalVolumeDocument,
  SeasonalWeightedDeltaBDocument,
  SeasonalWeightedPriceDocument,
} from '~/generated/graphql';
import { apolloClient } from '~/graph/client';
import { getMultiChainToken, TokenInstance } from '~/hooks/beanstalk/useTokens';
import {
  BEAN_CRV3_LP,
  BEAN_CRV3_V1_LP,
  BEAN_ETH_UNIV2_LP,
  BEAN_ETH_WELL_LP,
  BEAN_LUSD_LP,
  BEAN_WSTETH_WELL_LP,
} from '~/constants/tokens';
import { toSeasonNumber } from '~/util/Season';
import { fetchApolloWithLimiter } from './Bottleneck';

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
  whitelistTokenRewards: () => ['whitelistTokenRewards'],

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

export type SeasonsQueryFetchType = 'l1-only' | 'l2-only' | 'both';

interface SeasonRange {
  start: number;
  end: number;
}
interface MinViableQueryOptions {
  season_lte: number;
  first: number;
}

export type DynamicSGQueryOption<> = (
  subgraph: EvmLayer
) => Partial<QueryOptions>;

// ==========================================================
// Constants
// ==========================================================
const beanstalkETH = BEANSTALK_ADDRESSES[SupportedChainId.ETH_MAINNET];

const beanstalkARB = BEANSTALK_ADDRESSES[SupportedChainId.ARBITRUM_MAINNET];

const RESEED_SEASON_TIMESTAMP = 1728525600;

const PAGE_SIZE = 1000;

const INIT_SEASON_LTE = 999999999;

const L2_MIN_SEASON = RESEED_SEASON; // season 25129

const L1_MAX_SEASON = RESEED_SEASON - 1; // season 25128

const L1_MIN_SEASON = 1;

const VAR_FRAGMENTS = {
  gt: {
    l2: { season_gt: L2_MIN_SEASON - 1 },
    l1: { season_gt: L1_MIN_SEASON - 1 },
  },
  gte: {
    l2: { season_gte: L2_MIN_SEASON },
    l1: { season_gte: L1_MIN_SEASON },
  },
};

const CONTEXT_FRAGMENTS = {
  bean: {
    l2: 'bean',
    l1: 'bean_eth',
  },
  beanstalk: {
    l2: 'beanstalk',
    l1: 'beanstalk_eth',
  },
};

// ==========================================================
// Dynamic SG Query Options
// ==========================================================
function makeOptions(
  chain: EvmLayer,
  opts?: {
    ctx?: keyof typeof CONTEXT_FRAGMENTS;
    vars?: Partial<QueryOptions>['variables'];
    add?: (keyof typeof VAR_FRAGMENTS)[];
  }
) {
  const ctx = opts?.ctx ?? 'beanstalk';

  const options = {
    variables: {
      ...(opts?.add ?? []).reduce<any>(
        (prev, curr) => ({
          ...prev,
          ...VAR_FRAGMENTS[curr][chain],
        }),
        {}
      ),
      ...(opts?.vars ?? {}),
    },
    context: {
      subgraph: CONTEXT_FRAGMENTS[ctx][chain],
    },
  };

  return options;
}

const l1TokenSeasonsFilters = {
  [BEAN_ETH_WELL_LP[1].symbol]: { start: 15624 },
  [BEAN_WSTETH_WELL_LP[1].symbol]: { start: 23347 },
  [BEAN_CRV3_LP[1].symbol]: { start: REPLANT_SEASON - 1 },
  [BEAN_ETH_UNIV2_LP[1].symbol]: { start: 0, end: REPLANT_SEASON },
  [BEAN_LUSD_LP[1].symbol]: { start: 0, end: REPLANT_SEASON },
  [BEAN_CRV3_V1_LP[1].symbol]: { start: 3658, end: REPLANT_SEASON },
};

const getSeasonalUnripeChopRateOptions =
  (address: string): DynamicSGQueryOption =>
  (chain) =>
    makeOptions(chain, {
      add: ['gt'],
      vars: {
        token: getMultiChainToken(address)[chain].address.toLowerCase(),
      },
    });

const depositedSiloTokenOptions =
  (token: TokenInstance): DynamicSGQueryOption =>
  (chain) => {
    const tkn = getMultiChainToken(token.address);
    const options = makeOptions(chain, {
      vars: {
        siloAsset: `${(chain === 'l1' ? beanstalkETH : beanstalkARB).toLowerCase()}-${tkn[chain].address.toLowerCase()}`,
      },
      add: ['gt'],
    });

    if (chain === 'l2') return options;

    const l1Filters = l1TokenSeasonsFilters[token.symbol];

    if (l1Filters.start) {
      options.variables.season_gt = Math.max(l1Filters.start - 1, 0);
    }
    if (l1Filters.end) {
      options.variables.season_lte = l1Filters.end;
    }

    return options;
  };
const apyOptions =
  (token: TokenInstance): DynamicSGQueryOption =>
  (chain) => {
    const tkn = getMultiChainToken(token.address);
    const options = makeOptions(chain, {
      vars: {
        token: tkn[chain].address.toLowerCase(),
        season_gt: chain === 'l1' ? REPLANT_SEASON - 1 : L2_MIN_SEASON,
      },
    });

    if (chain === 'l2') {
      return options;
    }

    const l1Filters = l1TokenSeasonsFilters[token.symbol];
    if (l1TokenSeasonsFilters[token.symbol]?.start) {
      options.variables.season_gt = Math.max(l1Filters.start - 1, 0);
    }
    if (l1Filters?.end) {
      options.variables.season_lte = l1Filters.end;
    }

    return options;
  };
const tokenLiquidityOptions =
  (token: TokenInstance): DynamicSGQueryOption =>
  (chain) => {
    const tkn = getMultiChainToken(token.address);
    return makeOptions(chain, {
      vars: {
        pool: tkn[chain].address.toLowerCase(),
      },
      ctx: 'bean',
    });
  };

// prettier-ignore
export const subgraphQueryConfigs = {
  // ----------------------- Bean ------------------------
  priceInstantBEAN: {
    document: SeasonalInstantPriceDocument,
    queryKey: subgraphQueryKeys.priceInstantBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: 'bean', add: ['gt'] })
    ) satisfies DynamicSGQueryOption,
  },
  volumeBEAN: {
    document: SeasonalVolumeDocument,
    queryKey: subgraphQueryKeys.volumeBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: 'bean', add: ['gte'] })
    ) satisfies DynamicSGQueryOption,
  },
  totalLiquidityBEAN: {
    document: SeasonalLiquidityDocument,
    queryKey: subgraphQueryKeys.totalLiquidityBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: 'bean', add: ['gt'] })
    ) satisfies DynamicSGQueryOption,
  },
  marketCapBEAN: {
    document: SeasonalMarketCapDocument,
    queryKey: subgraphQueryKeys.marketCapBEAN,
    queryOptions: (
      (chain) => makeOptions(chain)
    ) satisfies DynamicSGQueryOption,
  },
  supplyBEAN: {
    document: SeasonalSupplyDocument,
    queryKey: subgraphQueryKeys.supplyBEAN,
    queryOptions: (
      (chain) => makeOptions(chain)
    ) satisfies DynamicSGQueryOption,
  },
  crossesBEAN: {
    document: SeasonalCrossesDocument,
    queryKey: subgraphQueryKeys.crossesBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: "bean" })
    ) satisfies DynamicSGQueryOption,
  },
  instantaneousDeltaBBEAN: {
    document: SeasonalInstantDeltaBDocument,
    queryKey: subgraphQueryKeys.instantaneousDeltaBBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: "bean", add: ["gte"] })
    ) satisfies DynamicSGQueryOption,
  },
  twaDeltaBBEAN: {
    document: SeasonalWeightedDeltaBDocument,
    queryKey: subgraphQueryKeys.twaDeltaBBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: "bean", add: ["gte"] })
    ) satisfies DynamicSGQueryOption,
  },
  twaPriceBEAN: {
    document: SeasonalWeightedPriceDocument,
    queryKey: subgraphQueryKeys.twaPriceBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: "bean", add: ["gte"] })
    ) satisfies DynamicSGQueryOption,
  },
  l2srBEAN: {
    document: LiquiditySupplyRatioDocument,
    queryKey: subgraphQueryKeys.l2srBEAN,
    queryOptions: (
      (chain) => makeOptions(chain, { ctx: "bean", add: ["gt"] })
    ) satisfies DynamicSGQueryOption,
  },
  

  // --------------------- Beanstalk ---------------------
  tokenLiquidity: (token: TokenInstance) => ({
    document: SeasonalLiquidityPerPoolDocument,
    queryKey: subgraphQueryKeys.tokenLiquidity(token),
    queryOptions: tokenLiquidityOptions(token),
  }),
  siloToken30DvAPY: (token: TokenInstance) => ({
    document: SeasonalApyDocument,
    queryKey: subgraphQueryKeys.siloToken30DvAPY(token),
    queryOptions: apyOptions(token),
  }),
  depositedSiloToken: (token: TokenInstance) => ({
    document: SeasonalDepositedSiloAssetDocument,
    queryKey: subgraphQueryKeys.depositedSiloToken(token),
    queryOptions: depositedSiloTokenOptions(token),
  }),
  seasonalChopRate: (token: TokenInstance) => ({
    document: SeasonalTokenChopRateDocument,
    queryKey: subgraphQueryKeys.seasonalChopRate(token),
    queryOptions: getSeasonalUnripeChopRateOptions(token.address),
  }),
  beanstalkTotalStalk: {
    document: SeasonalStalkDocument,
    queryKey: subgraphQueryKeys.beanstalkTotalStalk,
    queryOptions: (
      (chain) => makeOptions(chain, { 
        ctx: "beanstalk",
        vars: { 
          season_gt: chain === "l2" ? L2_MIN_SEASON : REPLANT_SEASON - 1,
          silo: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkRRoR: {
    document: SeasonalRRoRDocument,
    queryKey: subgraphQueryKeys.beanstalkRRoR,
    queryOptions: (
      (chain) => makeOptions(chain, { 
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkMaxTemperature: {
    document: SeasonalTemperatureDocument,
    queryKey: subgraphQueryKeys.beanstalkMaxTemperature,
    queryOptions: (
      (chain) => makeOptions(chain, {
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkUnharvestablePods: {
    document: SeasonalPodsDocument,
    queryKey: subgraphQueryKeys.beanstalkUnharvestablePods,
    queryOptions: (
      (chain) => makeOptions(chain, { 
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkPodRate: {
    document: SeasonalPodRateDocument,
    queryKey: subgraphQueryKeys.beanstalkPodRate,
    queryOptions: (
      (chain) => makeOptions(chain, { 
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkSownBeans: {
    document: SeasonalSownDocument,
    queryKey: subgraphQueryKeys.beanstalkSownBeans,
    queryOptions: (
      (chain) => makeOptions(chain, {
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkHarvestedPods: {
    document: SeasonalHarvestedPodsDocument,
    queryKey: subgraphQueryKeys.beanstalkHarvestedPods,
    queryOptions: (
      (chain) => makeOptions(chain, {
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption,
  },
  beanstalkTotalSowers: {
    document: SeasonalTotalSowersDocument,
    queryKey: subgraphQueryKeys.beanstalkTotalSowers,
    queryOptions: (
      (chain) => makeOptions(chain, {
        vars: {
          field: (chain === "l2" ? beanstalkARB : beanstalkETH).toLowerCase()
        }
      })
    ) satisfies DynamicSGQueryOption, 
  }
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

export interface SGQueryParameters {
  /**
   * Id of this chart.
   */
  id: string;
  /**
   * The field in the GraphQL request that corresponds to a timestamp. Usually "createdAt" or "timestamp".
   */
  timeScaleKey: string;
  /**
   * The field in the GraphQL request that corresponds to the value that will be charted.
   */
  priceScaleKey: string;
  /**
   * The Apollo document of the GraphQL query.
   */
  document: DocumentNode;
  /**
   * The entity that contains the data in your GraphQL request. Usually "seasons".
   */
  documentEntity: string;
  /**
   *
   */
  fetchType: SeasonsQueryFetchType;
  /**
   * Sets up things like variables and context for the GraphQL queries.
   */
  queryConfig: DynamicSGQueryOption;
}

const EVM_LAYERS: EvmLayer[] = ['l2', 'l1'];

const shouldFetchWithChain = (params: SGQueryParameters, chain: EvmLayer) => {
  const fetchL2 = params.fetchType !== 'l1-only';
  const fetchL1 = params.fetchType !== 'l2-only';

  if (fetchL2 && chain === 'l2') return true;
  if (fetchL1 && chain === 'l1') return true;
  return false;
};

// prettier-ignore
export async function fetchAllSeasonData(
  params: SGQueryParameters,
  season: number,
  fetchAll: boolean = true
) {
  const output: Record<number, any> = {};

  const options: QueryOptions[] = [];

  for (const chain of EVM_LAYERS) {
    if (!shouldFetchWithChain(params, chain)) {
      continue;
    }

    const cachedSeasons: number[] = [];
    const cachedData = readCachedData(params, chain);
    cachedData?.[params.documentEntity].forEach((sd: any) => {
      const seasonNum = toSeasonNumber(sd.season);
      cachedSeasons.push(seasonNum);
      output[seasonNum] = { ...sd, season: seasonNum };
    });

    const chainOptions = optimizeQueriesWithCached(params, cachedSeasons, season, chain, fetchAll);
    options.push(...chainOptions);
  }

  const apolloRequests = options
    .map((opts) => ({
      id: getRequstIdWithParams(opts, params, fetchAll),
      request: () => apolloClient.query({ ...opts, fetchPolicy: 'network-only' }),
    }))

  if (apolloRequests.length > 0) {
    const results = await fetchApolloWithLimiter(apolloRequests, { 
      throws: false, 
      partialData: true 
    });
    results.forEach((result) => {
      result.data?.[params.documentEntity]?.forEach((sd: any) => {
        const seasonNum = toSeasonNumber(sd.season);
        output[seasonNum] = { ...sd, season: seasonNum };
      })
    })
  }

  const result = Object.values(output);
  console.debug("[graph/fetchAllSeasonData] RESULT:", result);
  return result;
}

function getRequstIdWithParams(
  options: QueryOptions,
  params: SGQueryParameters,
  fetchAll: boolean
) {
  const vars = options.variables ?? {};
  const first = vars.first ?? 0;
  const season_lte = vars.season_lte ?? 0;

  return `${params.id}-${params.documentEntity}-${first}-${season_lte}-all=${fetchAll}`;
}

function optimizeQueriesWithCached(
  params: SGQueryParameters,
  cachedSeasons: number[],
  season: number,
  chain: EvmLayer,
  fetchAll: boolean
): QueryOptions[] {
  const seasonalOptions = deriveSeasonalOptions(
    params,
    chain,
    season,
    fetchAll
  );
  // If deriveSeasonalOptions() returns undefined, we don't fetch any data
  if (!seasonalOptions) return [];

  const { options, minSeason, maxSeason } = seasonalOptions;

  const existingRanges = findSeasonDataRanges(cachedSeasons);
  const missingRanges = findMissingSeasonDataRanges(
    existingRanges,
    minSeason,
    maxSeason
  );

  const optimalQueries = generateOptimalQueries(missingRanges);

  console.debug(
    `[graph/fetchAllSeasonData/optimizeQueriesWithCached] chain=${chain}: `,
    {
      cachedSeasons,
      missingRanges,
      optimalQueries,
      options,
      minSeason,
      maxSeason,
    }
  );

  return optimalQueries.map((vars) => ({
    ...options,
    query: params.document,
    variables: {
      ...(options.variables ?? {}),
      ...vars,
    },
  }));
}

/**
 * Given an array of season for which we have data,
 * derive the ranges of data that we currently have.
 * @param cachedSeasons
 */
function findSeasonDataRanges(cachedSeasons: number[]): SeasonRange[] {
  if (cachedSeasons.length === 0) {
    return [];
  }

  cachedSeasons.sort((a, b) => a - b);

  const ranges: SeasonRange[] = [];
  let rangeStart = cachedSeasons[0];
  let prevSeason = cachedSeasons[0];

  for (let i = 1; i < cachedSeasons.length; i += 1) {
    const currentSeason = cachedSeasons[i];
    if (currentSeason > prevSeason + 1) {
      ranges.push({ start: rangeStart, end: prevSeason });
      rangeStart = currentSeason;
    }
    prevSeason = currentSeason;
  }
  ranges.push({ start: rangeStart, end: prevSeason });

  return ranges;
}

/**
 * From the ranges of data that we have,
 * find the missing season ranges of data that we need to fetch.
 * @returns range of missing seasons
 */
function findMissingSeasonDataRanges(
  cachedRanges: SeasonRange[],
  start: number,
  end: number
): SeasonRange[] {
  cachedRanges.sort((a, b) => b.end - a.end);

  const missingRanges: SeasonRange[] = [];
  let currentSeason = end;

  for (const range of cachedRanges) {
    if (currentSeason > range.end) {
      missingRanges.push({ start: range.end + 1, end: currentSeason });
    }
    currentSeason = range.start - 1;
  }

  if (currentSeason >= start) {
    missingRanges.push({ start: start, end: currentSeason });
  }

  console.debug('[graph/fetchAllSeasonData/findMissingSeasonDataRanges]', {
    missingRanges,
  });

  // If we are only missing one season in a range,
  // it is most likely missing in the subgraph - skip it.
  if (missingRanges.length === 1) {
    const only = missingRanges[0];
    if (only.end === only.start && only.end === start) {
      return [];
    }
  }

  return missingRanges;
}

/**
 * Given the missing season ranges, generate the
 * optimal queries to fetch the data.
 */
function generateOptimalQueries(
  missingRanges: SeasonRange[]
): MinViableQueryOptions[] {
  const queries: MinViableQueryOptions[] = [];

  for (const range of missingRanges) {
    let seasonsToFetch = range.end - range.start + 1;
    let currentSeason = range.end;

    while (seasonsToFetch > 0) {
      const first = Math.min(seasonsToFetch, PAGE_SIZE);
      queries.push({ season_lte: currentSeason, first });
      currentSeason -= first;
      seasonsToFetch -= first;
    }
  }

  return queries;
}

/**
 * Attemps to read and return first 100_000 records of cached data from the Apollo cache.
 */
function readCachedData(
  config: SGQueryParameters,
  chain: EvmLayer
): any | null {
  const season_lte = chain === 'l2' ? INIT_SEASON_LTE : L1_MAX_SEASON;
  return apolloClient.readQuery<any>({
    query: config.document,
    variables: {
      season_lte: season_lte,
      first: 100_000,
    },
  });
}

/**
 * Derive query options for a given season and chain
 *
 * Subgraphs return different ranges of seasons given the chain:
 *
 * |=========|=============|=============|
 * |         |   minSeason |   maxSeason |
 * |---------|-------------|-------------|
 * | non_eth |           1 |       25129 |
 * | x_eth   |       25129 |     current |
 * |=========|=============|=============|
 *
 * We use seasons 1 -> 25129 from the x_eth subgraphs
 * We use seasons 25130 -> current from the l2 subgraphs
 *
 */
function deriveSeasonalOptions(
  config: SGQueryParameters,
  chain: EvmLayer,
  season: number,
  fetchAll: boolean
) {
  const isL2 = chain === 'l2';
  const l1Only = config.fetchType === 'l1-only';
  const fetchBoth = config.fetchType === 'both';
  const options = { ...config.queryConfig(chain) } as QueryOptions;
  const context = options.context ?? { subgraph: 'beanstalk' };

  if (!isL2 && !context.subgraph.includes('_eth')) {
    context.subgraph = `${context.subgraph}_eth`;
  }
  if (isL2 && context.subgraph.includes('_eth')) {
    context.subgraph = context.subgraph.split('_eth')[0];
  }

  options.context = context;

  let maxSeason: number;
  let minSeason: number;

  const fetchPreL2Migration = season - PAGE_SIZE < L2_MIN_SEASON;

  if (fetchAll) {
    maxSeason = isL2 ? season : options.variables?.season_lte ?? L1_MAX_SEASON;
    minSeason = Math.max(
      isL2 ? L2_MIN_SEASON : 1,
      options?.variables?.season_gt ?? 1,
      options?.variables?.season_gte ? options.variables.season_gte - 1 : 1
    );

    return {
      maxSeason,
      minSeason,
      options,
    };
  }

  if (isL2) {
    maxSeason = season;
    minSeason = Math.max(L2_MIN_SEASON, season - PAGE_SIZE);
  } else if (
    // If fetchType === 'both',
    // Only need to fetch L1 Data if current season < 1000 seasons past the L2 migration
    (fetchBoth && fetchPreL2Migration) ||
    l1Only
  ) {
    maxSeason = L1_MAX_SEASON;
    minSeason = L1_MAX_SEASON - PAGE_SIZE;
  } else {
    return undefined;
  }

  return {
    maxSeason,
    minSeason,
    options,
  };
}
