import React from 'react';
import {
  Box,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import SingleAdvancedChart from '~/components/Analytics/SingleAdvancedChart';
import { ChartQueryData } from '~/components/Analytics/AdvancedChart';
import useChartTimePeriodState from '~/hooks/display/useChartTimePeriodState';
import BigNumber from 'bignumber.js';

type SeasonsToCatchUpInfoProps = {
  queryData: ChartQueryData[];
  loading: boolean;
  error: boolean;
  timeState: ReturnType<typeof useChartTimePeriodState>;
};

const SeasonsToCatchUpInfo = (props: SeasonsToCatchUpInfoProps) => (
  <Stack>
    <Stack gap={1} py={2} px={1.5}>
      <Box>
        <Typography variant="h4">
          Target Seasons to Catch Up is set to 4320 Seasons, or 6 months.
        </Typography>
        <Typography color="text.secondary">
          This determines the rate at which new Depositors catch up to existing
          Depositors in terms of Grown Stalk per BDV.
        </Typography>
      </Box>
      <Typography>
        During periods of few new Deposits, the Grown Stalk per BDV will
        increase.
      </Typography>
      <MuiLink
        href="https://docs.bean.money/almanac/protocol/glossary#target-seasons-to-catchup"
        target="_blank"
        underline="always"
        color="primary.main"
      >
        Read more about the Target Seasons to Catch Up
      </MuiLink>
    </Stack>
    <Divider />
    <Stack p={1.5} width="100%">
      <SingleAdvancedChart
        storageKeyPrefix="silo-avg-seeds-per-bdv"
        tooltipTitle="Average Seeds per BDV"
        tooltipHoverText="The number of stalk issued per Season for each bean in the Silo."
        valueAxisType="stalk"
        timeState={props.timeState}
        tickFormatter={(val) => new BigNumber(val).toFormat(6)}
        seriesData={props.queryData}
        isLoading={props.loading}
        error={props.error}
        drawPegLine={false}
      />
    </Stack>
  </Stack>
);
export default SeasonsToCatchUpInfo;
