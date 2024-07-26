import React, { useMemo } from 'react';
import {
  Box,
  Breakpoint,
  Button,
  Chip,
  Grid,
  GridProps,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import useToggle from '~/hooks/display/useToggle';
import { ERC20Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import useSdk from '~/hooks/sdk';
import { ZERO_BN } from '~/constants';
import { displayFullBN } from '~/util';
import useSeedGauge from '~/hooks/beanstalk/useSeedGauge';
import { useAppSelector } from '~/state';
import {
  IconSize,
  BeanstalkPalette as Palette,
} from '~/components/App/muiTheme';
import { ArrowDownward, ArrowUpward, ArrowRight } from '@mui/icons-material';
import logo from '~/img/tokens/bean-logo.svg';
import { Link as RouterLink } from 'react-router-dom';

type GridConfigProps = Pick<GridProps, Breakpoint>;

type ISeedGaugeRow = {
  token: ERC20Token;
  totalGrownStalkPerBDV: BigNumber;
  gaugePoints: BigNumber;
  gaugePointsPerBDV: BigNumber;
  optimalBDVPct: BigNumber;
  currentBDVPct: BigNumber;
  totalBDV: BigNumber;
  deltaStalkPerSeason: BigNumber | undefined;
};

type ISeedGaugeColumn = {
  key: string;
  header: string;
  headerTooltip?: string;
  render: (data: ISeedGaugeRow) => string | JSX.Element;
  align?: 'left' | 'right';
  mobileAlign?: 'left' | 'right';
};

const GridConfig: Record<
  string,
  {
    advanced: GridConfigProps;
    // basic is optional b/c the default view limits which ones are shown
    basic?: GridConfigProps;
    hideMobile?: boolean;
  }
> = {
  token: {
    advanced: { xs: 4, lg: 2 },
    basic: { xs: 2.5, sm: 6 },
  },
  totalBDV: {
    advanced: { lg: 2 },
    hideMobile: true,
  },
  gaugePoints: {
    advanced: { lg: 2 },
    hideMobile: true,
  },
  gaugePointsPerBDV: {
    advanced: { lg: 2 },
    hideMobile: true,
  },
  optimalBDVPct: {
    advanced: { xs: 4, lg: 2 },
    basic: { xs: 5, sm: 3 },
  },
  currentLPBDVPct: {
    advanced: { xs: 4, lg: 2 },
    basic: { xs: 4.5, sm: 3 },
  },
};

const displayBNValue = (
  value: BigNumber | undefined,
  defaultValue?: string | number
) => {
  if (!value || value.eq(0)) return defaultValue?.toString() || 'N/A';
  return displayFullBN(value, 2);
};

const isNonZero = (value: BigNumber | undefined) => value && !value.eq(0);

const TokenColumn: ISeedGaugeColumn = {
  key: 'token',
  header: 'Token',
  align: 'left',
  render: ({ token }) => (
    <Stack direction="row" gap={1} alignItems="center">
      <Box
        component="img"
        src={token.logo}
        alt={token.name}
        height={IconSize.medium}
      />
      <Typography color="text.primary">{token.symbol}</Typography>
    </Stack>
  ),
};

const chipSx = {
  '& .MuiChip-label': {
    padding: '4px',
  },
  height: 'unset',
  width: 'unset',
  borderRadius: '4px',
  fontSize: '16px', // set manually
  lineHeight: '16px', // set manually
  background: Palette.lightestGreen,
  color: Palette.logoGreen,
};

const BDVPctColumns: ISeedGaugeColumn[] = [
  {
    key: 'optimalBDVPct',
    header: 'Optimal BDV %',
    render: ({ optimalBDVPct, gaugePoints }) => {
      if (!gaugePoints || gaugePoints.eq(0)) {
        return <Typography color="text.tertiary">N/A</Typography>;
      }
      return (
        <Chip
          variant="filled"
          label={`${displayBNValue(optimalBDVPct, '0')}%`}
          sx={chipSx}
        />
      );
    },
  },
  {
    key: 'currentLPBDVPct',
    header: 'Current LP BDV %',
    render: ({ optimalBDVPct, currentBDVPct, gaugePoints }) => {
      if (!gaugePoints || gaugePoints.eq(0)) {
        return <Typography color="text.tertiary">N/A</Typography>;
      }
      const isOptimal = currentBDVPct.eq(optimalBDVPct);

      return (
        <Chip
          variant="filled"
          label={`${displayBNValue(currentBDVPct, '0')}%`}
          sx={{
            ...chipSx,
            color: isOptimal ? Palette.logoGreen : Palette.theme.winter.red,
            background: isOptimal ? Palette.lightestGreen : Palette.lightestRed,
          }}
        />
      );
    },
  },
];

const basicViewColumns: ISeedGaugeColumn[] = [TokenColumn, ...BDVPctColumns];

const advancedViewColumns: ISeedGaugeColumn[] = [
  TokenColumn,
  {
    key: 'totalBDV',
    header: 'Total BDV',
    render: ({ totalBDV }) => (
      <Stack direction="row" alignItems="center" gap={0.25}>
        <img src={logo} style={{ width: 'auto', height: '.85rem' }} alt="" />
        <Typography
          color={isNonZero(totalBDV) ? 'text.primary' : 'text.tertiary'}
        >
          {displayBNValue(totalBDV)}
        </Typography>
      </Stack>
    ),
  },
  {
    key: 'gaugePoints',
    header: 'Gauge Points',
    render: ({ gaugePoints }) => (
      <Typography
        color={isNonZero(gaugePoints) ? 'text.primary' : 'text.tertiary'}
      >
        {displayBNValue(gaugePoints)}
      </Typography>
    ),
  },
  {
    key: 'gaugePointsPerBDV',
    header: 'Gauge Points per BDV',
    render: ({ gaugePointsPerBDV }) => (
      <Typography
        color={isNonZero(gaugePointsPerBDV) ? 'text.primary' : 'text.tertiary'}
      >
        {displayBNValue(gaugePointsPerBDV)}
      </Typography>
    ),
  },
  ...BDVPctColumns,
];

const useTableConfig = (
  advancedView: boolean,
  gaugeData: ReturnType<typeof useSeedGauge>['data']
) => {
  const sdk = useSdk();
  const siloBalances = useAppSelector((s) => s._beanstalk.silo.balances);

  const rowData = useMemo(() => {
    const baseTokens = [sdk.tokens.BEAN_ETH_WELL_LP];
    const tokens = advancedView
      ? [
          sdk.tokens.BEAN,
          ...baseTokens,
          sdk.tokens.UNRIPE_BEAN,
          sdk.tokens.UNRIPE_BEAN_WETH,
        ]
      : baseTokens;

    const mappedData: ISeedGaugeRow[] = tokens.map((token) => {
      const tokenSettings = gaugeData?.tokenSettings[token.address];

      const siloBal = siloBalances[token.address];

      const rowSeedData: ISeedGaugeRow = {
        token: token,
        totalBDV: (siloBal?.bdvPerToken || ZERO_BN).times(
          siloBal?.deposited.amount || ZERO_BN
        ),
        totalGrownStalkPerBDV: tokenSettings?.stalkIssuedPerBdv || ZERO_BN,
        gaugePoints: tokenSettings?.gaugePoints || ZERO_BN,
        gaugePointsPerBDV: tokenSettings?.gaugePointsPerBdv || ZERO_BN,
        optimalBDVPct: tokenSettings?.optimalPercentDepositedBdv || ZERO_BN,
        currentBDVPct: tokenSettings?.currentPercentDepositedBdv || ZERO_BN,
        deltaStalkPerSeason: tokenSettings?.deltaStalkEarnedPerSeason,
      };

      return rowSeedData;
    });

    return mappedData;
  }, [sdk, siloBalances, advancedView, gaugeData?.tokenSettings]);

  return rowData;
};

const ExpectedSeedRewardDirection = (row: ISeedGaugeRow) => {
  const optimal = row.optimalBDVPct?.eq(row.currentBDVPct);

  if (!row.gaugePoints || row.gaugePoints.lte(0) || optimal) {
    return null;
  }

  const isBelow = row.currentBDVPct?.lt(row.optimalBDVPct);

  const direction = isBelow ? 'increase' : 'decrease';
  const Arrow = isBelow ? ArrowUpward : ArrowDownward;
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      alignItems="center"
      pr={{ xs: 2, md: 4 }}
      gap={0.25}
      sx={{ display: { sm: 'none' } }}
    >
      <Arrow sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
      <Typography color="text.secondary">
        Expected Seed Reward {direction} next Season
      </Typography>
    </Stack>
  );
};

const GridColumn = ({
  column,
  isAdvanced,
  ...gridProps
}: {
  column: ISeedGaugeColumn;
  isAdvanced: boolean;
} & GridProps) => {
  const configKey = isAdvanced ? 'advanced' : 'basic';
  const config = GridConfig[column.key];
  const selectedConfig = config?.[configKey];

  if (!(column.key in GridConfig) || !selectedConfig) return null;

  const hideMobile = config.hideMobile || false;

  return (
    <Grid
      item
      display="flex"
      textAlign={column.align || 'right'}
      alignItems="center"
      justifyContent={column.align === 'left' ? 'flex-start' : 'flex-end'}
      {...selectedConfig}
      {...gridProps}
      sx={({ breakpoints }) => ({
        [breakpoints.down('lg')]: {
          textAlign: column.mobileAlign || column.align || 'right',
          justifyContent:
            (column.mobileAlign || column.align) === 'left'
              ? 'flex-start'
              : 'flex-end',
          display: hideMobile ? 'none' : 'flex',
        },
        ...gridProps.sx,
      })}
    />
  );
};

const ARROW_WIDTH = '20px';

const buttonSx = {
  py: 1.5,
  px: 2,
  borderWidth: '0.5px',
  borderColor: 'divider',
  background: 'light.main',
  '&:hover': {
    borderColor: 'primary.main',
    backgroundColor: 'primary.light',
  },
};

const lastChildSx = {
  '&:last-child': {
    pr: {
      xs: 0,
      md: ARROW_WIDTH,
    },
  },
};

const ArrowRightAdornment = () => (
  <Stack
    display={{ xs: 'none', md: 'block' }}
    sx={{ width: ARROW_WIDTH }}
    alignItems="center"
  >
    <ArrowRight
      sx={{
        color: 'secondary.main',
        position: 'relative',
        top: '3px',
        marginRight: '-3px',
      }}
    />
  </Stack>
);

const SeedGaugeTable = ({
  data,
}: {
  data: ReturnType<typeof useSeedGauge>['data'];
}) => {
  const [isAdvanced, show, hide] = useToggle();
  const rows = useTableConfig(isAdvanced, data);
  const cols = isAdvanced ? advancedViewColumns : basicViewColumns;

  return (
    <Stack>
      <Box sx={{ borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Stack px={3}>
          {/* Show Advanced */}
          <Stack pt={1.5} direction="row" alignItems="center" gap={1}>
            <Typography variant="bodySmall">
              Show additional information
            </Typography>
            <Switch
              size="small"
              value={isAdvanced}
              onChange={() => (isAdvanced ? hide : show)()}
              inputProps={{ 'aria-label': 'controlled' }}
              sx={({ breakpoints }) => ({
                display: { md: 'none' },
                // [breakpoints.down('md')]: {
                //   display: 'none',
                // },
              })}
            />
          </Stack>

          {/* Headers */}
          <Stack pt={1} pb={1.5}>
            <Grid container direction="row">
              {cols.map((column) => (
                <GridColumn
                  column={column}
                  isAdvanced={isAdvanced}
                  key={`sg-header-${column.key}`}
                  sx={lastChildSx}
                >
                  <Tooltip title={column.headerTooltip || ''}>
                    <Typography
                      color="text.secondary"
                      align="inherit"
                      textAlign="inherit"
                    >
                      {column.header}
                    </Typography>
                  </Tooltip>
                </GridColumn>
              ))}
            </Grid>
          </Stack>
        </Stack>
      </Box>

      {/* Rows */}
      <Stack p={1} gap={1}>
        {rows.map((row, i) => (
          <Box key={`seed-gauge-row-${i}-${row.token.symbol}`}>
            <Button
              component={RouterLink}
              to={`/silo/${row.token.address}`}
              fullWidth
              variant="outlined"
              color="primary"
              size="large"
              sx={buttonSx}
            >
              <Stack width="100%">
                <Grid container>
                  {cols.map((column, j) => (
                    <GridColumn
                      key={`sgr-${i}-${row.token.symbol}-${j}`}
                      column={column}
                      isAdvanced={isAdvanced}
                    >
                      <Stack direction="row" alignItems="center">
                        {column.render(row)}
                        {j === cols.length - 1 && <ArrowRightAdornment />}
                      </Stack>
                    </GridColumn>
                  ))}
                </Grid>
                <ExpectedSeedRewardDirection {...row} />
              </Stack>
            </Button>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
};

export default SeedGaugeTable;
