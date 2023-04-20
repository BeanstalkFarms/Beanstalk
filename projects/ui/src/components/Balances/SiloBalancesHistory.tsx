import React, { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import useAccount from '~/hooks/ledger/useAccount';
import { BaseDataPoint } from '~/components/Common/Charts/ChartPropProvider';
import useTimeTabState from '~/hooks/app/useTimeTabState';
import BaseSeasonPlot, { QueryData } from '~/components/Common/Charts/BaseSeasonPlot';
import { SILO_WHITELIST } from '~/constants/tokens';
import { SEASON_RANGE_TO_COUNT, SeasonRange } from '~/hooks/beanstalk/useSeasonsQuery';
import MockPlot from '../Silo/MockPlot';
import BlurComponent from '../Common/ZeroState/BlurComponent';
import WalletButton from '../Common/Connection/WalletButton';
import useFarmerSiloHistory from '~/hooks/farmer/useFarmerSiloHistory';

const SiloBalancesHistory: React.FC<{}> = () => {
  //
  const account = useAccount();
  const timeTabParams = useTimeTabState();
  const { data, loading } = useFarmerSiloHistory(account, true, false);

  const formatValue = (value: number) =>
    `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const getStatValue = <T extends BaseDataPoint>(v?: T[]) => {
    if (!v?.length) return 0;
    const dataPoint = v[0];
    return dataPoint?.value || 0;
  };

  const seriesInput = useMemo(() => data.deposits, [data.deposits]);

  // filter data using selected time tab
  const filteredSeries = useMemo(() => {
    if (timeTabParams[0][1] !== SeasonRange.ALL) {
      if (Array(seriesInput)) {
        return [seriesInput].map((s) =>
          s.slice(-(SEASON_RANGE_TO_COUNT[timeTabParams[0][1]] as number)
        ));
      }
    }
    return Array(seriesInput);
  }, [seriesInput, timeTabParams]);

  const queryData: QueryData = {
    data: filteredSeries as BaseDataPoint[][],
    loading: loading,
    keys: SILO_WHITELIST.map((t) => t[1].address),
    error: undefined
  };

  return (
    <Box sx={{ width: '100%', height: '380px', position: 'relative' }}>
      {account !== undefined ? (
        <BaseSeasonPlot
          queryData={queryData}
          height={300}
          StatProps={{
            title: 'Total Deposited Value',
            gap: 0.25,
          }}
          timeTabParams={timeTabParams}
          formatValue={formatValue}
          stackedArea
          ChartProps={{
            getDisplayValue: getStatValue,
            tooltip: true,
          }}
        />
      ) : (
        <>
          <MockPlot />
          <BlurComponent>
            <Stack justifyContent="center" alignItems="center" height="100%" gap={1}> 
              <Typography variant="body1" color="text.tertiary">Your Deposits will appear here.</Typography>
              <WalletButton showFullText color="primary" sx={{ height: 45 }} />
            </Stack>
          </BlurComponent>
        </>
      )}
    </Box>
  );
};

export default SiloBalancesHistory;
