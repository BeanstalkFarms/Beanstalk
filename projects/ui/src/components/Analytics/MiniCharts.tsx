import React, { useMemo, useState } from 'react';
import { FC } from '~/types';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Box, Card, CircularProgress } from '@mui/material';
import { apolloClient } from '~/graph/client';
import ChartV2 from './ChartV2';
import { useChartSetupData } from './useChartSetupData';

const MiniCharts: FC<{}> = () => {

  const season = useSeason();
  const chartSetupData = useChartSetupData();

  const selectedCharts: number[] = useMemo(() => { 
    const chartsToUse = ['Bean Price', 'Market Cap', 'Supply', 'Inst. deltaB'];
    const output: any[] = [];
    chartsToUse.forEach((chartName) => {
      const chartId = chartSetupData.findIndex((setupData) => setupData.name === chartName)
      if (chartId > -1) {
        output.push(chartId)
      };
    });
    return output;
  }, [chartSetupData]);


  const [queryData, setQueryData] = useState<any[]>([]);
  const [moreData, setMoreData] = useState<Map<any, any>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);

  useMemo(() => {
    async function getSeasonData(getAllData?: boolean) {
      const promises: any[] = [];
      const output: any[] = [];
      const extraOutput = new Map();
      const timestamps = new Map();

      for (let i = 0; i < selectedCharts.length; i += 1) {

        const chartId = selectedCharts[i];
        const queryConfig = chartSetupData[chartId].queryConfig;
        const document = chartSetupData[chartId].document;
        const entity = chartSetupData[chartId].documentEntity;

        const currentSeason = season.toNumber();

        const iterations = getAllData ? Math.ceil(currentSeason / 1000) + 1 : 1;
        for (let j = 0; j < iterations; j += 1) {
          const startSeason = getAllData ? currentSeason - (j * 1000) : 999999999;
          if (startSeason <= 0) continue;
          promises.push( 
            apolloClient.query({
            ...queryConfig,
            query: document,
            variables: {
              ...queryConfig?.variables,
              first: 168,
              season_lte: startSeason,
            },
            notifyOnNetworkStatusChange: true,
            fetchPolicy: 'cache-first',
          })
          .then((r) => {
            r.data[entity].forEach((seasonData: any) => {
              if (seasonData?.season) {
                if (!output[chartId]?.length) {
                  output[chartId] = [];
                };
                if (!timestamps.has(seasonData.season)) {
                  timestamps.set(seasonData.season, Number(seasonData[chartSetupData[chartId].timeScaleKey]));
                };
                const formattedTime = timestamps.get(seasonData.season);
                const formattedValue = chartSetupData[chartId].valueFormatter(seasonData[chartSetupData[chartId].priceScaleKey]);
                output[chartId][seasonData.season] = { time: formattedTime, value: formattedValue };
                extraOutput.set(formattedTime, seasonData.season);
              };
            });
          }));
        };
      }
      await Promise.all(promises);
      output.forEach((dataSet, index) => { output[index] = dataSet.filter(Boolean) });
      setQueryData(output);
      setMoreData(extraOutput);
    }

    setLoading(true);
    getSeasonData();
    setLoading(false);
  }, [chartSetupData, selectedCharts, season]);

  return (
    <>
      <Box display='flex' flexDirection='row' gap={2}>
        {selectedCharts.map((chart) => (
            <Card sx={{ width: '100%', height: 150 }}>
            {!loading ? (
              <ChartV2
                formattedData={queryData}
                extraData={moreData}
                selected={[chart]}
                priceFormatter={chartSetupData[chart].valueFormatter}
                size="mini"
                containerHeight={150}
              />
            ) : (
              <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress variant="indeterminate" />
              </Box>
            )}
            </Card>            
          )
        )}
      </Box>
    </>
  );
};

export default MiniCharts;
