import { useMemo, useState } from 'react';
import { ChartQueryData } from '~/components/Analytics/AdvancedChart';
import { useChartSetupData } from '~/components/Analytics/useChartSetupData';
import { apolloClient } from '~/graph/client';
import { exists } from '~/util/UI';
import { FetchPolicy } from '@apollo/client';
import useSeason from './useSeason';

export type UseSeasonsQueryV2Props = {
  chartName: string;
  preventFetch?: boolean;
  getAllData?: boolean;
  fetchPolicy?: FetchPolicy;
  filterZeroValues?: boolean;
};

/**
 * Integrates w/ useChartSetupData
 * Logic from useAdvancedChart.tsx & modified to use for 1 gql document
 * @notes
 *  - Recommended to place this at the parent level
 *  - Will default to fetching all the data. To prevent, set getAllData to false
 *  - Pass in preventFetch to prevent fetching data
 */
function useSeasonsQueryV2({
  chartName,
  preventFetch,
  getAllData,
  fetchPolicy,
  filterZeroValues,
}: UseSeasonsQueryV2Props): readonly [
  data: {
    seriesData: ChartQueryData[];
    chartId: number | undefined;
  },
  loading: boolean,
  error: boolean,
] {
  const [queryData, setQueryData] = useState<ChartQueryData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const season = useSeason();

  const chartSetupData = useChartSetupData();
  const chartId = chartSetupData.find(
    (_data) => _data.name === chartName
  )?.index;

  useMemo(() => {
    if (
      season.lte(0) ||
      chartId === undefined ||
      !!queryData.length ||
      preventFetch
    ) {
      return;
    }
    async function getSeasonData(fetchAll?: boolean) {
      const promises: any[] = [];
      const timestamps = new Map();

      const outputMap: { [k: number]: ChartQueryData } = {};

      const maxRetries = 4;
      for (let retries = 0; retries < maxRetries; retries += 1) {
        console.debug('[useSeasonsQueryV2] Fetching data...');
        const chartProps = chartId ? chartSetupData[chartId] : undefined;
        try {
          if (!chartProps) {
            throw new Error(
              `Chart ${chartId} could not be found in chartSetupData`
            );
          }
          const queryConfig = chartProps.queryConfig;
          const document = chartProps.document;
          const entity = chartProps.documentEntity;
          const currentSeason = season.toNumber();

          const iterations = fetchAll ? Math.ceil(currentSeason / 1000) + 1 : 1;

          for (let j = 0; j < iterations; j += 1) {
            const startSeason = fetchAll ? currentSeason - j * 1000 : 999999999;
            if (startSeason <= 0) continue;
            promises.push(
              apolloClient
                .query({
                  ...queryConfig,
                  query: document,
                  variables: {
                    ...queryConfig?.variables,
                    first: 1000,
                    season_lte: startSeason,
                  },
                  notifyOnNetworkStatusChange: true,
                  fetchPolicy:
                    fetchPolicy || queryConfig?.fetchPolicy || 'network-only',
                })
                .then((r) => {
                  r.data[entity].forEach((seasonData: any) => {
                    if (!seasonData?.season) return;
                    if (!timestamps.has(seasonData.season)) {
                      timestamps.set(
                        seasonData.season,
                        Number(seasonData[chartProps.timeScaleKey])
                      );
                    }

                    const currTS = timestamps.get(seasonData.season);
                    const prevTS = timestamps.get(seasonData.season - 1);
                    const nextTS = timestamps.get(seasonData.season + 1);

                    // Some charts will occasionally return two seasons as having the
                    // same timestamp, here we ensure we only have one datapoint per timestamp
                    if (nextTS === currTS || prevTS === currTS) return;

                    const fmt = chartProps.dataFormatter;
                    const _seasonData = fmt ? fmt(seasonData) : seasonData;
                    if (!exists(_seasonData)) return;

                    const formattedValue = chartProps.valueFormatter(
                      _seasonData[chartProps.priceScaleKey]
                    );

                    if (currTS > 0 && exists(formattedValue)) {
                      if (filterZeroValues && formattedValue === 0) return;
                      outputMap[_seasonData.season] = {
                        time: currTS,
                        value: formattedValue,
                        customValues: {
                          season: _seasonData.season,
                        },
                      };
                    }
                  });
                })
            );
          }

          await Promise.all(promises);

          const values = Object.values(outputMap).filter(Boolean);
          values.sort((a, b) => Number(a.time) - Number(b.time));
          setQueryData(values);
          console.debug('[useSeasonsQueryV2] Fetched data successfully!', {
            first5: values.slice(0, 5),
            iterations: iterations,
          });
          break;
        } catch (e) {
          console.debug('[useSeasonsQueryV2] Failed to fetch data.');
          console.error(e);
          if (retries === maxRetries - 1) {
            setError(true);
          }
        }
      }
    }

    setLoading(true);
    getSeasonData(getAllData ?? true);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chartSetupData,
    season,
    chartId,
    preventFetch,
    fetchPolicy,
    filterZeroValues,
  ]);

  return [{ seriesData: queryData, chartId }, loading, error] as const;
}

export default useSeasonsQueryV2;
