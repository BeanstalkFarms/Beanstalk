import { BigNumber } from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';
import { DocumentNode, gql } from '@apollo/client';
import { BeanstalkSDK, ERC20Token } from '@beanstalk/sdk';
import { Time, Range } from 'lightweight-charts';
import * as LegacyToken from '~/constants/tokens';

import { ChartQueryData } from '~/components/Analytics/AdvancedChart';
import useSdk from '~/hooks/sdk';
import { apolloClient } from '~/graph/client';
import { toBNWithDecimals } from '~/util';
import { SupportedChainId, ZERO_BN } from '~/constants';
import { TokenInstance, useGetNormaliseChainToken } from './useTokens';

type SeasonMap<T> = { [season: number]: T };

type SiloAssetsReturn = {
  season: number;
  depositedBDV: string;
  createdAt: string;
};

type WhitelistReturn = {
  season: number;
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

type SiloTokenDataBySeason = SeasonMap<{
  [address: string]: Partial<MergedQueryData>;
}>;

const MAX_DATA_PER_QUERY = 1000;

const SEED_GAUGE_DEPLOYMENT_SEASON = 21798;

const SEED_GAUGE_DEPLOYMENT_TIMESTAMP = 1716408000;

const L2_MIGRATION_SEASON = 25133;

const UNREACHABLE_SEASON = 999999999;

const apolloFetch = async (
  document: DocumentNode,
  first: number,
  season: number,
  subgraph: 'beanstalk_eth' | 'beanstalk'
) =>
  apolloClient.query({
    query: document,
    variables: { first, season_lte: season },
    fetchPolicy: 'no-cache',
    notifyOnNetworkStatusChange: true,
    context: { subgraph: subgraph },
  });

// Main hook with improved error handling and performance
const useAvgSeedsPerBDV = (
  range: Range<Time> | undefined,
  skip = false
): readonly [
  seriesData: ChartQueryData[],
  isLoading: boolean,
  isError: boolean,
] => {
  const [queryData, setQueryData] = useState<ChartQueryData[]>([]);
  const [numQueries, setNumQueries] = useState<number>(getNumQueries(range));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const normaliseToken = useGetNormaliseChainToken();

  useEffect(() => {
    const iterations = getNumQueries(range);
    setNumQueries((prevNumQueries) => Math.max(prevNumQueries, iterations));
  }, [range]);

  const sdk = useSdk();

  const fetch = useCallback(async () => {
    if (skip) return;
    setError(false);
    setLoading(true);
    console.debug('[useAvgSeedsPerBDV/fetch]: fetching...');

    const l2Tokens = [
      LegacyToken.BEAN[SupportedChainId.ARBITRUM_MAINNET],
      LegacyToken.BEAN_ETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET],
      LegacyToken.BEAN_WSTETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET],
      LegacyToken.BEAN_WEETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET],
      LegacyToken.BEAN_WBTC_WELL_LP[SupportedChainId.ARBITRUM_MAINNET],
      LegacyToken.BEAN_USDC_WELL_LP[SupportedChainId.ARBITRUM_MAINNET],
      LegacyToken.BEAN_USDT_WELL_LP[SupportedChainId.ARBITRUM_MAINNET],
    ];

    const l1Tokens = [
      LegacyToken.BEAN[SupportedChainId.ETH_MAINNET],
      LegacyToken.BEAN_ETH_WELL_LP[SupportedChainId.ETH_MAINNET],
      LegacyToken.BEAN_WSTETH_WELL_LP[SupportedChainId.ETH_MAINNET],
    ];

    const l2Document = createMultiTokenQuery(
      sdk.addresses.BEANSTALK.get(SupportedChainId.ARBITRUM_MAINNET),
      l2Tokens
    );

    const l1Document = createMultiTokenQuery(
      sdk.addresses.BEANSTALK.get(SupportedChainId.ETH_MAINNET),
      l1Tokens
    );

    const output: SiloTokenDataBySeason = {};
    let earliestSeason = UNREACHABLE_SEASON;

    try {
      if (numQueries === 0) {
        setError(true);
        throw new Error(
          'Avg Seeds Per BDV fetch: Invalid range. Expected numQueries > 0 but got 0.'
        );
      }

      const fetchDatas = async (lte: number, chain: SupportedChainId) => {
        const isL2 = chain === SupportedChainId.ARBITRUM_MAINNET;
        const subgraph = isL2 ? 'beanstalk' : 'beanstalk_eth';
        const doc = isL2 ? l2Document : l1Document;
        const tokens = isL2 ? l2Tokens : l1Tokens;

        return apolloFetch(doc, MAX_DATA_PER_QUERY, lte, subgraph).then((r) => {
          earliestSeason = parseResult(
            r.data,
            sdk,
            tokens,
            output,
            normaliseToken
          );
        });
      };

      let chainId = SupportedChainId.ARBITRUM_MAINNET;

      await fetchDatas(earliestSeason, chainId);

      if (earliestSeason === UNREACHABLE_SEASON) {
        chainId = SupportedChainId.ETH_MAINNET;
        await fetchDatas(earliestSeason, chainId);
      }

      if (numQueries > 1) {
        const _seasons: { lte: number; chain: SupportedChainId }[] = [];
        for (let i = 0; i < numQueries - 1; i += 1) {
          const offset = (i + 1) * MAX_DATA_PER_QUERY - MAX_DATA_PER_QUERY;
          const season_lte = Math.max(0, earliestSeason - offset);

          if (season_lte <= L2_MIGRATION_SEASON) {
            chainId = SupportedChainId.ETH_MAINNET;
          }

          if (season_lte < SEED_GAUGE_DEPLOYMENT_SEASON) break;
          _seasons.push({
            lte: season_lte,
            chain:
              season_lte > L2_MIGRATION_SEASON
                ? SupportedChainId.ARBITRUM_MAINNET
                : SupportedChainId.ETH_MAINNET,
          });
        }

        const seasons = _seasons.filter(Boolean);

        await Promise.all(
          seasons.map((season) => fetchDatas(season.lte, season.chain))
        );
      }

      const normalized = normalizeQueryResults(sdk, output);
      setQueryData(normalized);

      console.debug('[useAvgSeedsPerBDV/fetch]: results: ', {
        output: getOutputHuman(output),
        normalized,
      });
    } catch (e) {
      console.debug('[useAvgSeedsPerBDV/fetch]: FAILED: ', e);
      console.error(e);
      setError(true);
    } finally {
      console.debug('[useAvgSeedsPerBDV/fetch]: fetch complete...');
      setLoading(false);
    }
  }, [numQueries, sdk, skip, normaliseToken]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return [queryData, loading, error] as const;
};

export default useAvgSeedsPerBDV;

/// ---------- UTILS ----------

function getNumQueries(range: Range<Time> | undefined): number {
  const from = Math.max(
    Number((range?.from || 0).valueOf()),
    SEED_GAUGE_DEPLOYMENT_TIMESTAMP
  );

  // always fetch to the latest season
  const to = Number(Date.now() / 1000).valueOf();
  const numSeasons = Math.floor((to - from) / 3600);

  return Math.ceil(numSeasons / MAX_DATA_PER_QUERY);
}

function createMultiTokenQuery(
  beanstalkAddress: string,
  tokens: TokenInstance[]
) {
  const queryParts = tokens.map(
    (token) => `seasonsSA_${token.address}: siloAssetHourlySnapshots(
      first: $first
      orderBy: season
      orderDirection: desc
      where: {
        siloAsset: "${beanstalkAddress.toLowerCase()}-${token.address.toLowerCase()}"
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
    seasonsWL_${token.address}: whitelistTokenHourlySnapshots(
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
    }`
  );

  return gql`
    query MultiTokenSiloAssetAverageSeedsPerBDV(
      $first: Int!
      $season_lte: Int!
    ) {
      ${queryParts.join('\n')}
    }
  `;
}

function processTokenData(
  token: TokenInstance,
  sData: SiloAssetsReturn | null,
  wData: WhitelistReturn | null,
  output: SiloTokenDataBySeason,
  sdk: BeanstalkSDK
) {
  const season = sData?.season || wData?.season;
  if (!season || season < SEED_GAUGE_DEPLOYMENT_SEASON) return;

  const { BEAN, SEEDS } = sdk.tokens;
  output[season] = output[season] || {};

  const existing = output[season][token.address] || {};

  const depositedBDV = existing.depositedBDV?.gt(0)
    ? existing.depositedBDV
    : toBNWithDecimals(sData?.depositedBDV || '0', BEAN.decimals);

  const stalkPerSeason = wData?.stalkEarnedPerSeason
    ? toBNWithDecimals(wData.stalkEarnedPerSeason, SEEDS.decimals)
    : undefined;

  const grownStalkPerSeason = stalkPerSeason?.gt(0)
    ? stalkPerSeason
    : existing.grownStalkPerSeason;

  output[season][token.address] = {
    ...existing,
    depositedBDV,
    grownStalkPerSeason,
    createdAt: sData?.createdAt || wData?.createdAt || existing.createdAt,
    season,
  };
}

function parseResult(
  data: any,
  sdk: BeanstalkSDK,
  tokens: TokenInstance[],
  output: SiloTokenDataBySeason,
  normalizeToken: (token: string) => ERC20Token | undefined
) {
  let earliestSeason = UNREACHABLE_SEASON;

  for (const chainToken of tokens) {
    const siloAssets = data[
      `seasonsSA_${chainToken.address}`
    ] as SiloAssetsReturn[];
    const whitelisted = data[
      `seasonsWL_${chainToken.address}`
    ] as WhitelistReturn[];

    const token = normalizeToken(chainToken.address);

    if (!siloAssets?.length || !whitelisted?.length || !token) {
      continue;
    }

    // Results are sorted in desc order.
    earliestSeason = Math.max(
      earliestSeason,
      Math.max(
        siloAssets[siloAssets.length - 1].season,
        whitelisted[whitelisted.length - 1].season
      )
    );

    const whitelistedMap = new Map(whitelisted.map((w) => [w.season, w]));

    siloAssets.forEach((sData) => {
      const wData = whitelistedMap.get(sData.season);
      processTokenData(token, sData, wData || null, output, sdk);
      whitelistedMap.delete(sData.season);
    });

    // Process any remaining
    whitelistedMap.forEach((wData) => {
      processTokenData(token, null, wData, output, sdk);
    });
  }

  return earliestSeason;
}

// Optimized data normalization
function normalizeQueryResults(
  sdk: BeanstalkSDK,
  output: SiloTokenDataBySeason
): ChartQueryData[] {
  const map: { [season: number]: ChartQueryData } = {};
  const timestamps = new Set<Time>();

  Object.entries(output).forEach(([_season, entity]) => {
    const season = Number(_season);
    const obj = Object.entries(entity).reduce<Partial<MergedQueryData>>(
      (prev, [tokenAddress, curr]) => {
        if (!curr.grownStalkPerSeason || !curr.depositedBDV || !curr.createdAt)
          return prev;

        if (
          season > SEED_GAUGE_DEPLOYMENT_SEASON &&
          sdk.tokens.BEAN_CRV3_LP.address === tokenAddress
        ) {
          return prev;
        }

        const ratio = curr.grownStalkPerSeason.times(curr.depositedBDV);

        return {
          season: season,
          createdAt: curr.createdAt,
          grownStalkPerBDV: (prev.grownStalkPerBDV || ZERO_BN).plus(ratio),
          depositedBDV: (prev.depositedBDV || ZERO_BN).plus(curr.depositedBDV),
        };
      },
      {}
    );

    if (!obj.depositedBDV || !obj.grownStalkPerBDV || !obj.createdAt) return;

    const value = obj.grownStalkPerBDV.div(obj.depositedBDV);

    const time = (Number(obj.createdAt) * 60 * 60) as Time;

    if (value.gt(0) && !timestamps.has(time)) {
      map[season] = {
        customValues: { season: season },
        time: time,
        value: value.toNumber(),
      };
      timestamps.add(time);
    }
  });

  return Object.values(map).sort((a, b) => Number(a.time) - Number(b.time));
}

function getOutputHuman(output: SiloTokenDataBySeason) {
  const _output = Object.entries(output).reduce((prev, [k, v]) => {
    const obj = Object.entries(v).reduce(
      (memo, [key, value]) => ({
        ...memo,
        [key]: {
          depositedBDV: value.depositedBDV?.toNumber(),
          grownStalkPerSeason: value.grownStalkPerSeason?.toNumber(),
          createdAt: value.createdAt,
          season: value.season,
          grownStalkPerBDV: value.grownStalkPerBDV?.toNumber(),
        },
      }),
      {}
    );
    return { ...prev, [k]: obj };
  }, {});

  return _output;
}
