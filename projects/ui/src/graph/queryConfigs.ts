import { RESEED_SEASON, UNRIPE_BEAN_ADDRESSES, UNRIPE_BEAN_WSTETH_ADDRESSES } from '~/constants';
import { SeasonalInstantPriceDocument, SeasonalTokenChopRateDocument } from '~/generated/graphql';
import { REPLANT_SEASON } from '~/hooks/beanstalk/useHumidity';
import { getMultiChainToken } from '~/hooks/beanstalk/useTokens';

const l2UrBeanAddress = UNRIPE_BEAN_ADDRESSES[42161]
const l2UrBeanLPAddress = UNRIPE_BEAN_WSTETH_ADDRESSES[42161]

const getSeasonalInstantOptions = (chain: 'l1' | 'l2') => {
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
const getSeasonalUnripeChopRateOptions = (address: string) => (chain: 'l1' | 'l2') => {
  const tokens = getMultiChainToken(address);
  const options = {
    query: SeasonalTokenChopRateDocument,
    variables: {
      season_gt: RESEED_SEASON - 1,
      token: tokens[42161].address.toLowerCase()
    },
    context: { subgraph: 'beanstalk' },
  };

  if (chain === 'l1') {
    options.variables.season_gt = REPLANT_SEASON[1].toNumber() - 1;
    options.variables.token = tokens[1].address.toLowerCase();
    options.context.subgraph = 'beanstalk_eth';
  }

  return options;
}
const urBeanChopRateOptions = getSeasonalUnripeChopRateOptions(l2UrBeanAddress);
const urBeanLPChopRateOptions = getSeasonalUnripeChopRateOptions(l2UrBeanLPAddress);

// prettier-ignore
export const subgraphQueryKeys = {
  // ----- Bean ----- //
  priceInstant: () => 'seasonalInstantPrice',


  // ----- Beanstalk ----- //

  // Silo
  seasonalUrBeanChopRate: () => ['seasonalTokenChopRate', l2UrBeanAddress].join(","),
  seasonalUrBeanLPChopRate: () => ['seasonalTokenChopRate', l2UrBeanLPAddress].join(","),

  // Farmer
  farmerSiloRewards: (account: string | undefined) => ['farmerSiloRewards', account ?? "no-account"],
  farmerSiloAssetSnapshots: (account: string | undefined) => ['farmerSiloAssetSnapshots', account ?? "no-account"],
}

export const subgraphQueryConfigs = {
  // ----- Bean ----- //
  priceInstant: {
    document: SeasonalInstantPriceDocument,
    queryKey: subgraphQueryKeys.priceInstant,
    queryOptions: getSeasonalInstantOptions,
  },
  seasonalUrBeanChopRate: {
    document: SeasonalTokenChopRateDocument,
    queryKey: subgraphQueryKeys.seasonalUrBeanChopRate,
    queryOptions: urBeanChopRateOptions,
  },
  seasonalUrBeanLPChopRate: {
    document: SeasonalTokenChopRateDocument,
    queryKey: subgraphQueryKeys.seasonalUrBeanLPChopRate,
    queryOptions: urBeanLPChopRateOptions,
  },
};
