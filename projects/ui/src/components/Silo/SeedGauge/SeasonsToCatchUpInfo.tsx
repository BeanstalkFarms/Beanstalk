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
  seriesData: ChartQueryData[];
  queryLoading: boolean;
  queryError: boolean;
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
        During periods of many new Deposits, the Grown Stalk per BDV will
        decrease. During periods of few new Deposits, the Grown Stalk per BDV
        will increase.
      </Typography>
      <MuiLink
        href="https://docs.bean.money/almanac/farm/silo/seed-gauge-system#grown-stalk-inflation-rate"
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
        tooltipHoverText="The number of Stalk issued per Season per BDV in the Silo."
        valueAxisType="stalk"
        tickFormatter={(val) => new BigNumber(val).toFormat(6)}
        drawPegLine={false}
        {...props}
      />
    </Stack>
  </Stack>
);
export default SeasonsToCatchUpInfo;
