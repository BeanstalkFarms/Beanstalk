import { DocumentNode, QueryOptions } from '@apollo/client';
import {
  BEANSTALK_ADDRESSES,
  REPLANT_SEASON,
  RESEED_SEASON,
  SupportedChainId,
  UNRIPE_BEAN_ADDRESSES,
  UNRIPE_BEAN_WSTETH_ADDRESSES,
} from '~/constants';
import {
  SeasonalDepositedSiloAssetDocument,
  SeasonalInstantPriceDocument,
  SeasonalTokenChopRateDocument,
} from '~/generated/graphql';
import { getMultiChainToken, TokenInstance } from '~/hooks/beanstalk/useTokens';

// prettier-ignore
export const subgraphQueryKeys = {
  // -----------------------------------------------------
  // ----------------------- Bean ------------------------
  // -----------------------------------------------------
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


  // -----------------------------------------------------
  // --------------------- Beanstalk ---------------------
  // -----------------------------------------------------

  // ------ Silo ------
  beanstalkTotalStalk: 'seasonalBeanstalkTotalStalk',
  beanstalkRRoR: 'seasonalBeanstalkRRoR',
  
  depositedSiloToken: (token: TokenInstance) => ['seasonalSiloTokenDeposited', token.symbol].join("-"),
  siloToken30DvAPY: (token: TokenInstance) => ['seasonal30DvAPY', token.symbol].join("-"),

  // Unripe
  seasonalChopRate: (token: TokenInstance) => ['seasonalTokenChopRate', token.symbol].join("-"),

  // ----- Field -----
  beanstalkMaxTemperature: 'seasonalBeanstalkMaxTemperature',
  beanstalkUnharvestablePods: 'seasonalBeanstalkUnharvestablePods',
  beanstalkPodRate: 'seasonalBeanstalkPodRate',
  beanstalkSownBeans: 'seasonalBeanstalkSownBeans',
  beanstalkHarvestedPods: 'seasonalBeanstalkHarvestedPods',
  beanstalkTotalSowers: 'seasonalBeanstalkTotalSowers',
  
  // ------ Farmer Silo ------
  farmerSiloRewards: (account: string | undefined) => ['farmerSiloRewards', account ?? "no-account"].join("-"),
  farmerSiloAssetSnapshots: (account: string | undefined) => ['farmerSiloAssetSnapshots', account ?? "no-account"].join("-"),
}

type EvmLayer = 'l1' | 'l2';

export type DynamicQueryOption = (subgraph: EvmLayer) => Partial<QueryOptions>;

const beanstalkETH = BEANSTALK_ADDRESSES[SupportedChainId.ETH_MAINNET];
const beanstalk = BEANSTALK_ADDRESSES[SupportedChainId.ARBITRUM_MAINNET];
const l2UrBeanAddress = UNRIPE_BEAN_ADDRESSES[42161];
const l2UrBeanLPAddress = UNRIPE_BEAN_WSTETH_ADDRESSES[42161];

const getSeasonalInstantOptions: DynamicQueryOption = (chain) => {
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
  (address: string): DynamicQueryOption =>
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
const depositedSiloTokenOptions = (
  token: TokenInstance
): DynamicQueryOption => {
  const tkn = getMultiChainToken(token.address);
  return (chain) => {
    const options = {
      variables: {
        season_gt: RESEED_SEASON - 1,
        siloAsset: `${beanstalk}-${tkn.arb.address}`,
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

type DynamicSGQueryOptions = (...args: any[]) => Partial<QueryOptions>;

interface SGQueryConfig<
  T extends DynamicQueryOption | DynamicSGQueryOptions = DynamicQueryOption,
> {
  document: DocumentNode;
  queryKey: string;
  queryOptions: T;
}

type DynamicSGQueryConfig<
  T extends DynamicQueryOption | DynamicSGQueryOptions = DynamicQueryOption,
> = (...args: any[]) => SGQueryConfig<T>;

type SubgraphQueryConfig<
  T extends DynamicQueryOption | DynamicSGQueryOptions = DynamicQueryOption,
> = SGQueryConfig<T> | DynamicSGQueryConfig<T>;

const CONTEXTS = {
  beanstalk_eth: { context: { subgraph: 'beanstalk_eth' } },
  beanstalk: { context: { subgraph: 'beanstalk' } },
  bean: { context: { subgraph: 'bean' } },
  bean_eth: { context: { subgraph: 'bean_eth' } },
};

export const subgraphQueryConfigs = {
  // -----------------------------------------------------
  // ----------------------- Bean ------------------------
  // -----------------------------------------------------
  priceInstant: {
    document: SeasonalInstantPriceDocument,
    queryKey: subgraphQueryKeys.priceInstantBEAN,
    queryOptions: getSeasonalInstantOptions,
  } satisfies SGQueryConfig<DynamicQueryOption>,

  // -----------------------------------------------------
  // --------------------- Beanstalk ---------------------
  // -----------------------------------------------------

  // ------ Silo ------
  depositedSiloToken: (
    token: TokenInstance
  ): SGQueryConfig<DynamicQueryOption> => ({
    document: SeasonalDepositedSiloAssetDocument,
    queryKey: subgraphQueryKeys.depositedSiloToken(token),
    queryOptions: depositedSiloTokenOptions(token),
  }),

  // Unripe
  seasonalChopRate: (token: TokenInstance) => ({
    document: SeasonalTokenChopRateDocument,
    queryKey: subgraphQueryKeys.seasonalChopRate(token),
    queryOptions: getSeasonalUnripeChopRateOptions(token.address),
  }),
};
