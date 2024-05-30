import React, { useCallback, useMemo, useState } from 'react';
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
import {
  SeasonAggregation,
  SeasonRange,
  SEASON_RANGE_TO_COUNT,
} from '~/hooks/beanstalk/useSeasonsQuery';
import { FC } from '~/types';
import { BaseDataPoint, ChartMultiStyles } from '~/components/Common/Charts/ChartPropProvider';
import { displayStalk } from '~/util';
import StackedAreaChart from '../Common/Charts/StackedAreaChart';
import { BeanstalkPalette } from '../App/muiTheme';

export type OverviewPlotProps = {
  account: string | undefined;
  series: BaseDataPoint[][];
  stats: (
    dataPoint: BaseDataPoint | undefined
  ) => React.ReactElement;
  empty: boolean;
  loading: boolean;
  label: string;
  useStackedChart?: boolean;
  keysAndTooltips?: { [key: string] : string };
};

const OverviewPlot: FC<OverviewPlotProps> = ({
  account,
  series,
  stats,
  loading,
  empty,
  label,
  useStackedChart = false,
  keysAndTooltips = { 'First': 'First Tooltip' }
}) => {
  const [displayDataPoint, setDisplayDataPoint] = useState<BaseDataPoint | undefined>()

  const handleCursor = useCallback(
    (_: number | undefined, __?: number | undefined, ___?: Date | undefined, dataPoint?: BaseDataPoint | undefined) => {
      setDisplayDataPoint(dataPoint)
    }, []
  );

  const handleCursorLineChart = useCallback(
    (dataPoint?: BaseDataPoint[] | undefined) => {
      setDisplayDataPoint(dataPoint ? dataPoint[0] : undefined)
    }, []
  );

  const formatValueStacked = (value: number) => `${displayStalk(BigNumber(value, 10), 2)}`;

  const getStatValue = <T extends BaseDataPoint>(v?: T[]) => {
    if (!v?.length) return 0;
    const dataPoint = v[0];
    return dataPoint?.value || 0;
  };

  const [tabState, setTimeTab] = useState<TimeTabState>([
    SeasonAggregation.HOUR,
    SeasonRange.WEEK,
  ]);
  
  const handleChangeTimeTab = useCallback((tabs: TimeTabState) => {
    setTimeTab(tabs);
  }, []);

  const filteredSeries = useMemo(() => {
    if (tabState[1] !== SeasonRange.ALL) {
      return series.map((s) =>
        s.slice(-(SEASON_RANGE_TO_COUNT[tabState[1]] as number))
      );
    }
    return series;
  }, [series, tabState]);

  const chartStyle: ChartMultiStyles = {
    0: { 
      stroke: BeanstalkPalette.theme.spring.beanstalkGreen, 
      fillPrimary: BeanstalkPalette.theme.spring.washedGreen
    },
    1: { 
      stroke: BeanstalkPalette.darkBlue, 
      fillPrimary: BeanstalkPalette.blue 
    },
  };

  const keys = Object.keys(keysAndTooltips);

  const ready = account && !loading && !empty;

  return (
    <>
      <Row alignItems="flex-start" justifyContent="space-between" pr={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={{ xs: 1, md: 0 }}
          sx={{ px: 2, pb: { xs: 2, md: 0 } }}
          alignItems="flex-start"
        >
          {stats(displayDataPoint)}
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
          <>
          {useStackedChart ?
            <StackedAreaChart
              series={filteredSeries}
              keys={keys}
              onCursor={handleCursor}
              formatValue={formatValueStacked}
              getDisplayValue={getStatValue}
              stylesConfig={chartStyle}
              tooltip
              useCustomTooltipNames={keysAndTooltips}
            />
            : 
            <LineChart series={filteredSeries} onCursor={handleCursorLineChart} />
          }
          </>
        ) : (
          <>
            <MockPlot />
            <BlurComponent>
              <Stack
                justifyContent="center"
                alignItems="center"
                height="100%"
                gap={1}
              >
                {!account ? (
                  <>
                    <Typography variant="body1" color="text.tertiary">
                      Your {label} will appear here.
                    </Typography>
                    <WalletButton
                      showFullText
                      color="primary"
                      sx={{ height: 45 }}
                    />
                  </>
                ) : loading ? (
                  <CircularProgress
                    variant="indeterminate"
                    thickness={4}
                    color="primary"
                  />
                ) : empty ? (
                  <Typography variant="body1" color="text.tertiary">
                    Receive <TokenIcon token={STALK} />
                    Stalk and <TokenIcon token={SEEDS} />
                    Seeds for Depositing whitelisted assets in the Silo.
                    Stalkholders earn a portion of new Bean mints. Seeds grow
                    into Stalk every Season.
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
