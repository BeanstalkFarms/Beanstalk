import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';

import LineChart from '~/components/Common/Charts/LineChart';
import TimeTabs, { TimeTabState } from '~/components/Common/Charts/TimeTabs';
import WalletButton from '~/components/Common/Connection/WalletButton';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import BlurComponent from '~/components/Common/ZeroState/BlurComponent';
import MockPlot from '~/components/Silo/MockPlot';
import { SEEDS, STALK } from '~/constants/tokens';
import { SeasonAggregation, SeasonRange, SEASON_RANGE_TO_COUNT } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';
import { BaseDataPoint } from '~/components/Common/Charts/ChartPropProvider';

export type OverviewPlotProps = {
  account: string | undefined;
  season: BigNumber;
  current: BigNumber[];
  series: BaseDataPoint[][];
  stats: (season: BigNumber, value: BigNumber[]) => React.ReactElement;
  empty: boolean;
  loading: boolean;
  label: string;
};

const OverviewPlot: FC<OverviewPlotProps> = ({
  account,
  season,
  current,
  series,
  stats,
  loading,
  empty,
  label,
}) => {
  const [displaySeason, setDisplaySeason] = useState<BigNumber>(season);
  const [displayValue, setDisplayValue] = useState<BigNumber[]>(current);

  useEffect(() => setDisplayValue(current), [current]);
  useEffect(() => setDisplaySeason(season), [season]);

  const handleCursor = useCallback(
    (dps?: BaseDataPoint[]) => {
      setDisplaySeason(dps ? new BigNumber(dps[0].season) : season);
      setDisplayValue(dps ? dps.map((dp) => new BigNumber(dp.value)) : current);
    },
    [current, season]
  );

  const [tabState, setTimeTab] = useState<TimeTabState>([SeasonAggregation.HOUR, SeasonRange.WEEK]);
  const handleChangeTimeTab = useCallback(
    (tabs: TimeTabState) => {
      setTimeTab(tabs);
    },
    []
  );

  const filteredSeries = useMemo(() => {
    if (tabState[1] !== SeasonRange.ALL) {
      return series.map((s) => s.slice(-(SEASON_RANGE_TO_COUNT[tabState[1]] as number)));
    }
    return series;
  }, [series, tabState]);

  const ready = (
    account
    && !loading
    && !empty
  );

  return (
    <>
      <Row alignItems="flex-start" justifyContent="space-between" pr={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={{ xs: 1, md: 0 }}
          sx={{ px: 2, pb: { xs: 2, md: 0 } }}
          alignItems="flex-start"
        >
          {stats(displaySeason, displayValue)}
        </Stack>
        <Stack alignItems="right">
          <TimeTabs
            state={tabState}
            setState={handleChangeTimeTab}
            aggregation={false}
          />
        </Stack>
      </Row>
      <Box sx={{ width: '100%', height: '220px', position: 'relative' }}>
        {ready ? (
          <LineChart
            series={filteredSeries}
            onCursor={handleCursor}
          />
        ) : (
          <>
            <MockPlot />
            <BlurComponent>
              <Stack justifyContent="center" alignItems="center" height="100%" gap={1}>
                {!account ? (
                  <>
                    <Typography variant="body1" color="text.tertiary">Your {label} will appear here.</Typography>
                    <WalletButton showFullText color="primary" sx={{ height: 45 }} />
                  </>
                ) : loading ? (
                  <CircularProgress variant="indeterminate" thickness={4} color="primary" />
                ) : empty ? (
                  <Typography variant="body1" color="text.tertiary">
                    Receive <TokenIcon token={STALK} />Stalk and <TokenIcon token={SEEDS} />Seeds for Depositing whitelisted assets in the Silo. Stalkholders earn a portion of new Bean mints. Seeds grow into Stalk every Season.
                  </Typography>
                ) : null}
              </Stack>
            </BlurComponent>
          </>
        )}
      </Box>
    </>
  );
};

export default OverviewPlot;
