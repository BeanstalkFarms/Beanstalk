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

const maxDataPerQuery = 1000;

const getNumQueries = (range: Range<Time> | undefined) => {
  const from = Number((range?.from || 0).valueOf());
  const to = Number((range?.to || Date.now()).valueOf());
  const numSeasons = Math.floor((to - from) / 3600);

  const numQueries = Math.ceil(numSeasons / maxDataPerQuery);
  return {
    numQueries: numQueries,
    first: numSeasons,
  };
};

const parseResult = (sdk: BeanstalkSDK, data: any, output: OutputMap) => {
  const tokens = [...sdk.tokens.siloWhitelistedWellLP];
  const SEEDS = sdk.tokens.SEEDS;
  const BEAN = sdk.tokens.BEAN;

  tokens.forEach((token) => {
    const s = data[`seasonsSiloAssets_${token.symbol}`] as SiloAssetsReturn[];
    const w = data[`seasonsWhitelisted_${token.symbol}`] as WhitelistedReturn[];

    console.log(token.symbol, ' w: ', w);
    console.log(token.symbol, ' s: ', s);

    (s || []).forEach((sData) => {
      if (!output[sData.season]) {
        output[sData.season] = {};
      }
      const existing = output[sData.season][token.address] || {};
      const amount = existing?.depositedBDV?.gt(0)
        ? existing.depositedBDV
        : toBNWithDecimals(sData.depositedBDV || '0', BEAN.decimals);

      output[sData.season][token.address] = {
        ...existing,
        depositedBDV: amount,
        createdAt: existing.createdAt ?? sData.createdAt,
        season: sData.season,
      };
    });

    (w || []).forEach((wData) => {
      if (!output[wData.season]) {
        output[wData.season] = {};
      }
      const existing = output[wData.season][token.address] || {};
      let amount = existing?.grownStalkPerSeason?.gt(0)
        ? existing.grownStalkPerSeason
        : toBNWithDecimals(wData.stalkEarnedPerSeason || '0', SEEDS.decimals);

      if (token.symbol === sdk.tokens.BEAN_ETH_WELL_LP.symbol) {
        if (wData.season <= 21799) {
          amount = toBNWithDecimals('4500000', SEEDS.decimals);
        }
      }

      output[wData.season][token.address] = {
        ...existing,
        grownStalkPerSeason: amount,
        createdAt: existing.createdAt || wData.createdAt,
        season: existing.season || wData.season,
      };
    });

    // console.log('outputasdfadf: ', output);

    // return mapping;
  });
  console.log('-----');
};

const normalizeQueryResults = (output: OutputMap) => {
  const tsMap = new Map<number, number>();
  const map: SeasonMap<ChartQueryData> = {};

  // const sorted = Object.entries(output).sort(
  //   ([s1], [s2]) => Number(s1) - Number(s2)
  // );
  // const sortedOutput = Object.fromEntries(sorted);
  // console.log('sortedOutput: ', sortedOutput);

  const summate = (
    season: number,
    entity: { [address: string]: Partial<MergedQueryData> }
  ) => {
    const datum = Object.values(entity).reduce<Partial<MergedQueryData>>(
      (prev, curr) => {
        if (!curr.grownStalkPerSeason || !curr.depositedBDV) {
          return prev;
        }
        if (curr.createdAt && !tsMap.has(season)) {
          tsMap.set(season, Number(curr.createdAt));
          const currTS = tsMap.get(season);
          const prevTS = tsMap.get(season - 1);
          const nextTS = tsMap.get(season + 1);

          const amt = curr.grownStalkPerSeason.times(curr.depositedBDV);

          if (currTS === nextTS || currTS === prevTS) return prev;

          return {
            season: season,
            createdAt: curr.createdAt,
            grownStalkPerBDV: amt.plus(prev.grownStalkPerBDV || 0),
            depositedBDV: curr.depositedBDV.plus(prev.depositedBDV || 0),
          };
        }

        return prev;
      },
      {} as MergedQueryData
    );

    if (datum.depositedBDV && datum.grownStalkPerBDV && datum.createdAt) {
      map[season] = {
        customValues: {
          season,
        },
        time: Number(datum.createdAt) as Time,
        value: datum.grownStalkPerBDV.div(datum.depositedBDV).toNumber(),
      };
    }
  };

  // console.log('output: ', Object.keys(output).length);

  Object.entries(output).forEach(([season, entity]) => {
    summate(Number(season), entity);
    tsMap.clear();
  });

  const arr = Object.values(map).sort(
    (a, b) => Number(a.time) - Number(b.time)
  );
  // console.log('map: ', arr);

  return arr;
};

async function apolloFetch(
  document: DocumentNode,
  first: number,
  seasonLte: number
) {
  const query = apolloClient.query({
    query: document,
    variables: {
      first,
      season_lte: seasonLte,
    },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });

  return query;
}

export const useAverageSeedsPerBDV = (
  range: Range<Time> | undefined,
  skip?: boolean
): readonly [
  seriesData: ChartQueryData[],
  loading: boolean,
  error: boolean,
] => {
  const [data, setData] = useState<ChartQueryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const sdk = useSdk();

  const fetch = useCallback(async () => {
    const tokens = [...sdk.tokens.siloWhitelistedWellLP];
    const document = createMultiTokenQuery(tokens);

    const { first, numQueries } = getNumQueries(range);
    if (numQueries === 0) {
      throw new Error(`Invalid range`);
    }
    // console.log({
    //   first,
    //   numQueries,
    // });

    const output: OutputMap = {};
    const promises: Promise<any>[] = [];

    try {
      setLoading(true);
      if (numQueries === 1) {
        promises.push(
          apolloFetch(document, first, 999999999).then((r) => {
            parseResult(sdk, r.data, output);
          })
        );
      } else {
        const firstDatas = await apolloFetch(document, 1000, 999999999);
        parseResult(sdk, firstDatas.data, output);

        const initResult = Object.keys(output);
        const earliestSeason =
          initResult.length && Number(initResult.sort()[0]);

        if (earliestSeason <= 0) return;

        for (let i = 0; i < numQueries; i += 1) {
          const season = Math.max(0, earliestSeason - i * 1000);
          const numVals = season < 1000 ? season - 1 : 1000;

          promises.push(
            apolloFetch(document, numVals, season).then((r) => {
              // console.log(i, r.data);
              parseResult(sdk, r.data, output);
            })
          );
        }
      }
      await Promise.all(promises);
      // console.log('combiing...');
      // console.log('outpu: ', Object.values(output));
      setData(normalizeQueryResults(output));
    } catch (e) {
      console.error('[useAverageSeedsPerBDV/fetch]: FAILED: ', e);
      setError(true);
      return;
    } finally {
      setLoading(false);
    }
  }, [range, sdk]);

  useEffect(() => {
    if (skip) return;
    fetch();
  }, [fetch, skip]);

  return [data, loading, error] as const;
};

// beaneth: 16626
// beanwsteth: 23347
// bean3crv:
