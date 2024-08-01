import React, { useMemo } from 'react';
import {
  Box,
  Breakpoint,
  Card,
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
import { displayFullBN } from '~/util';
import useSeedGauge, {
  TokenSeedGaugeInfo,
} from '~/hooks/beanstalk/useSeedGauge';
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
} & TokenSeedGaugeInfo;

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
  }
> = {
  token: {
    advanced: { xs: 2, lg: 2 },
    basic: { xs: 2.5, sm: 5 },
  },
  totalBDV: {
    advanced: { xs: 2 },
  },
  gaugePoints: {
    advanced: { xs: 2 },
  },
  gaugePointsPerBDV: {
    advanced: { xs: 2 },
  },
  optimalBDVPct: {
    advanced: { xs: 2, lg: 2 },
    basic: { xs: 5, sm: 3 },
  },
  currentLPBDVPct: {
    advanced: { xs: 2 },
    basic: { xs: 4.5, sm: 4 },
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
    render: ({ optimalPctDepositedBdv }) => {
      if (optimalPctDepositedBdv.eq(0)) {
        return <Typography color="text.tertiary">N/A</Typography>;
      }
      return (
        <Chip
          variant="filled"
          label={`${displayBNValue(optimalPctDepositedBdv, '0')}%`}
          sx={chipSx}
        />
      );
    },
  },
  {
    key: 'currentLPBDVPct',
    header: 'Current LP BDV %',
    render: ({ optimalPctDepositedBdv, currentPctDepositedBdv }) => {
      if (optimalPctDepositedBdv.eq(0)) {
        return <Typography color="text.tertiary">N/A</Typography>;
      }
      const isOptimal = currentPctDepositedBdv.eq(optimalPctDepositedBdv);

      return (
        <Chip
          variant="filled"
          label={`${currentPctDepositedBdv.toFormat(0, BigNumber.ROUND_HALF_CEIL)}%`}
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
    render: ({ totalBdv }) => (
      <Stack direction="row" alignItems="center" gap={0.25}>
        <img src={logo} style={{ width: 'auto', height: '.85rem' }} alt="" />
        <Typography
          color={isNonZero(totalBdv) ? 'text.primary' : 'text.tertiary'}
        >
          {displayBNValue(totalBdv)}
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
    render: ({ gaugePointsPerBdv }) => {
      const isValidValue = isNonZero(gaugePointsPerBdv);
      return (
        <Typography color={isValidValue ? 'text.primary' : 'text.tertiary'}>
          {isValidValue ? gaugePointsPerBdv.toExponential(2, 2) : 'N/A'}
        </Typography>
      );
    },
  },
  ...BDVPctColumns,
];

const useTableConfig = (
  advancedView: boolean,
  gaugeData: ReturnType<typeof useSeedGauge>['data']
) => {
  const sdk = useSdk();
  const rowData = useMemo(() => {
    const baseTokens = [
      sdk.tokens.BEAN_ETH_WELL_LP,
      sdk.tokens.BEAN_WSTETH_WELL_LP,
    ];
    const tokens = advancedView
      ? [
          sdk.tokens.BEAN,
          ...baseTokens,
          sdk.tokens.UNRIPE_BEAN,
          sdk.tokens.UNRIPE_BEAN_WSTETH,
        ]
      : baseTokens;

    const mappedData = tokens.reduce<ISeedGaugeRow[]>((prev, token) => {
      const gaugeInfo = gaugeData?.gaugeData?.[token.address];

      if (gaugeInfo) {
        return [...prev, { token, ...gaugeInfo }];
      }

      return prev;
    }, []);

    return mappedData;
  }, [sdk, advancedView, gaugeData?.gaugeData]);

  return rowData;
};

const ExpectedSeedRewardDirection = (row: ISeedGaugeRow) => {
  const optimal = row.optimalPctDepositedBdv?.eq(row.currentPctDepositedBdv);

  if (!row.gaugePoints || row.gaugePoints.lte(0) || optimal) {
    return null;
  }

  const isBelow = row.currentPctDepositedBdv?.lt(row.optimalPctDepositedBdv);

  const direction = isBelow ? 'increase' : 'decrease';
  const Arrow = isBelow ? ArrowUpward : ArrowDownward;
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      alignItems="center"
      pr={2}
      gap={0.25}
      display={{ xs: 'none', md: 'flex' }}
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
        },
        ...gridProps.sx,
      })}
    />
  );
};

const ARROW_WIDTH = '20px';

const RowSx = {
  display: 'flex',
  py: 1.5,
  px: 2,
  borderWidth: '0.5px',
  borderColor: 'divider',
  background: 'white',
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
    <Box sx={{ overflowX: 'scroll' }}>
      <Stack sx={{ minWidth: isAdvanced ? '1100px' : 0 }}>
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
            <Box
              key={`seed-gauge-row-${i}-${row.token.symbol}`}
              component={RouterLink}
              to={`/silo/${row.token.address}`}
              sx={{ textDecoration: 'none' }}
            >
              <Card>
                <Box sx={RowSx}>
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
                </Box>
              </Card>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

export default SeedGaugeTable;
