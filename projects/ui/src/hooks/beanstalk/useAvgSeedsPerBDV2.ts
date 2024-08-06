import { BigNumber } from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';
import { DocumentNode, gql } from '@apollo/client';
import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import { Time, Range } from 'lightweight-charts';

import { ChartQueryData } from '~/components/Analytics/AdvancedChart';
import useSdk from '~/hooks/sdk';
import { apolloClient } from '~/graph/client';
import { toBNWithDecimals } from '~/util';

type SiloAssetsReturn = {
  season: number;
  siloAsset: {
    token: string;
  };
  depositedBDV: string;
  createdAt: string;
};

type SeasonMap<T> = { [season: number]: T };

type WhitelistedReturn = {
  season: number;
  token: {
    id: string;
  };
  stalkEarnedPerSeason: string;
  createdAt: string;
};

type MergedQueryData = {
  season: number;
  depositedBDV: BigNumber;
  grownStalkPerSeason: BigNumber;
  createdAt: string;
  grownStalkPerBDV: BigNumber;
  totalBDV: BigNumber;
};

type OutputMap = SeasonMap<{
  [address: string]: Partial<MergedQueryData>;
}>;

function createMultiTokenQuery(tokens: Token[]) {
  const queryParts = tokens.map(
    (token) => `
    seasonsSiloAssets_${token.symbol}: siloAssetHourlySnapshots(
      first: $first
      orderBy: season
      orderDirection: desc
      where: {
        siloAsset_contains: "${token.address.toLowerCase()}"
        season_lte: $season_lte
        depositedBDV_gt: 0
      }
    ) {
      id
      season
      siloAsset {
        token
      }
      depositedBDV
      createdAt
    }
    seasonsWhitelisted_${token.symbol}: whitelistTokenHourlySnapshots(
      first: $first
      orderBy: season
      orderDirection: desc
      where: {
        token: "${token.address.toLowerCase()}"
        season_lte: $season_lte
        stalkEarnedPerSeason_gt: 0
      }
    ) {
      id
      season
      token {
        id
      }
      stalkEarnedPerSeason
      createdAt
    }
  `
  );

  return gql`
    query MultiTokenSiloAssetAverageSeedsPerBDV(
      $first: Int!
      $season_lte: Int!
    ) {
      ${queryParts.join('')}
    }
  `;
}

const MAX_DATA_PER_QUERY = 1000;

// Improved type safety with explicit return type
const getNumQueries = (
  range: Range<Time> | undefined
): { numQueries: number; first: number } => {
  const from = Number((range?.from || 0).valueOf());
  const to = Number((range?.to || Date.now()).valueOf());
  const numSeasons = Math.floor((to - from) / 3600);

  return {
    numQueries: Math.ceil(numSeasons / MAX_DATA_PER_QUERY),
    first: numSeasons,
  };
};

// Separated data processing logic
const processTokenData = (
  token: Token,
  sData: SiloAssetsReturn | null,
  wData: WhitelistedReturn | null,
  output: OutputMap,
  sdk: BeanstalkSDK
) => {
  const season = sData?.season || wData?.season;
  if (!season) return;

  if (!output[season]) {
    output[season] = {};
  }

  const { BEAN, SEEDS, BEAN_ETH_WELL_LP } = sdk.tokens;
  const existing = output[season][token.address] || {};
  const depositedBDV = sData
    ? toBNWithDecimals(sData.depositedBDV || '0', BEAN.decimals)
    : existing.depositedBDV || new BigNumber(0);

  let grownStalkPerSeason = wData
    ? toBNWithDecimals(wData.stalkEarnedPerSeason || '0', SEEDS.decimals)
    : existing.grownStalkPerSeason || new BigNumber(0);

  // Special case handling
  if (token.equals(BEAN_ETH_WELL_LP) && wData && wData.season <= 21799) {
    grownStalkPerSeason = toBNWithDecimals('4500000', SEEDS.decimals);
  }

  output[season][token.address] = {
    ...existing,
    depositedBDV,
    grownStalkPerSeason,
    createdAt: sData?.createdAt || wData?.createdAt || existing.createdAt,
    season,
  };
};

const parseResult = (sdk: BeanstalkSDK, data: any, output: OutputMap) => {
  const tokens = [...sdk.tokens.siloWhitelistedWellLP];

  tokens.forEach((token) => {
    const siloAssets = data[
      `seasonsSiloAssets_${token.symbol}`
    ] as SiloAssetsReturn[];
    const whitelisted = data[
      `seasonsWhitelisted_${token.symbol}`
    ] as WhitelistedReturn[];

    // Create a map of seasons to whitelisted data for quick lookup
    const whitelistedMap = new Map(whitelisted.map((w) => [w.season, w]));

    // Iterate over siloAssets, and process whitelisted data in the same loop
    siloAssets.forEach((sData) => {
      const wData = whitelistedMap.get(sData.season);
      processTokenData(token, sData, wData || null, output, sdk);
      whitelistedMap.delete(sData.season); // Remove processed whitelisted data
    });

    // Process any remaining whitelisted data that didn't have corresponding siloAssets
    whitelistedMap.forEach((wData) => {
      processTokenData(token, null, wData, output, sdk);
    });
  });
};

// Optimized data normalization
const normalizeQueryResults = (output: OutputMap): ChartQueryData[] => {
  const map: { [season: number]: ChartQueryData } = {};

  Object.entries(output).forEach(([season, entity]) => {
    const seasonNumber = Number(season);
    const datum = Object.values(entity).reduce<Partial<MergedQueryData>>(
      (prev, curr) => {
        if (!curr.grownStalkPerSeason || !curr.depositedBDV || !curr.createdAt)
          return prev;

        return {
          season: seasonNumber,
          createdAt: curr.createdAt,
          grownStalkPerBDV: (prev.grownStalkPerBDV || new BigNumber(0)).plus(
            curr.grownStalkPerSeason.times(curr.depositedBDV)
          ),
          depositedBDV: (prev.depositedBDV || new BigNumber(0)).plus(
            curr.depositedBDV
          ),
        };
      },
      {}
    );

    if (datum.depositedBDV && datum.grownStalkPerBDV && datum.createdAt) {
      map[seasonNumber] = {
        customValues: { season: seasonNumber },
        time: Number(datum.createdAt) as Time,
        value: datum.grownStalkPerBDV.div(datum.depositedBDV).toNumber(),
      };
    }
  });

  return Object.values(map).sort((a, b) => Number(a.time) - Number(b.time));
};

const apolloFetch = async (
  document: DocumentNode,
  first: number,
  seasonLte: number
): Promise<any> => {
  try {
    const { data } = await apolloClient.query({
      query: document,
      variables: { first, season_lte: seasonLte },
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    });
    return data;
  } catch (error) {
    console.error('Apollo fetch error:', error);
    throw error;
  }
};

// Main hook with improved error handling and performance
export const useAverageSeedsPerBDV = (
  range: Range<Time> | undefined,
  skip = false
): readonly [ChartQueryData[], boolean, boolean] => {
  const [queryData, setQueryData] = useState<ChartQueryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const sdk = useSdk();

  const fetch = useCallback(async () => {
    if (skip) return;

    const tokens = [...sdk.tokens.siloWhitelistedWellLP];
    const document = createMultiTokenQuery(tokens);
    const { first, numQueries } = getNumQueries(range);

    if (numQueries === 0) {
      setError(true);
      console.error('Invalid range');
      return;
    }

    const output: OutputMap = {};
    setLoading(true);

    try {
      const fetchData = async (season: number) => {
        const data = await apolloFetch(document, Math.min(first, 1000), season);
        parseResult(sdk, data, output);
      };

      await fetchData(999999999);

      if (numQueries > 1) {
        const earliestSeason = Math.min(...Object.keys(output).map(Number));
        const promises = Array.from({ length: numQueries - 1 }, (_, i) =>
          fetchData(Math.max(0, earliestSeason - (i + 1) * 1000))
        );
        await Promise.all(promises);
      }

      setQueryData(normalizeQueryResults(output));
    } catch (e) {
      console.error('[useAverageSeedsPerBDV/fetch]: FAILED: ', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, sdk, skip]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return [queryData, loading, error] as const;
};
