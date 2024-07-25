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
import { ZERO_BN } from '~/constants';
import TokenIcon from '~/components/Common/TokenIcon';
import { displayFullBN } from '~/util';
import useSeedGauge from '~/hooks/beanstalk/useSeedGauge';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import { useAppSelector } from '~/state';
import { BeanstalkPalette as Palette } from '~/components/App/muiTheme';
import { ArrowDownward, ArrowUpward, ArrowRight } from '@mui/icons-material';

type GridConfigProps = Pick<GridProps, Breakpoint>;

type ISeedGaugeRow = {
  token: ERC20Token;
  totalGrownStalk: BigNumber;
  totalGrownStalkPerBDV: BigNumber;
  gaugePoints: BigNumber;
  gaugePointsPerBDV: BigNumber;
  optimalBDVPct: BigNumber;
  currentBDVPct: BigNumber;
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

const displayBNValue = (
  value: BigNumber | undefined,
  defaultValue?: string | number
) => {
  if (!value || value.eq(0)) return defaultValue?.toString() || 'N/A';
  return displayFullBN(value, 2);
};

const isNonZero = (value: BigNumber | undefined) => value && !value.eq(0);

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
    advanced: { xs: 4, lg: 1.5 },
    basic: { xs: 2.5, sm: 6 },
  },
  totalGrownStalk: {
    advanced: { lg: 1.5 },
    hideMobile: true,
  },
  totalGrownStalkPerBDV: {
    advanced: { lg: 2.5 },
    hideMobile: true,
  },
  gaugePoints: {
    advanced: { lg: 1.75 },
    hideMobile: true,
  },
  gaugePointsPerBDV: {
    advanced: { lg: 1.75 },
    hideMobile: true,
  },
  optimalBDVPct: {
    advanced: { xs: 4, lg: 1.5 },
    basic: { xs: 5, sm: 3 },
  },
  currentLPBDVPct: {
    advanced: { xs: 4, lg: 1.5 },
    basic: { xs: 4.5, sm: 3 },
  },
};

const TokenColumn: ISeedGaugeColumn = {
  key: 'token',
  header: 'Token',
  align: 'left',
  render: (data) => (
    <Stack direction="row" gap={0.5} alignItems="center">
      <TokenIcon token={data.token} />
      <Typography variant="bodySmall">{data.token.symbol}</Typography>
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
  fontSize: '14px', // set manually
  lineHeight: '17px', // set manually
};

const BDVPctColumns: ISeedGaugeColumn[] = [
  {
    key: 'optimalBDVPct',
    header: 'Optimal BDV %',
    render: ({ optimalBDVPct, gaugePoints }) => {
      if (!gaugePoints || gaugePoints.eq(0)) {
        return (
          <Typography variant="bodySmall" color="text.tertiary">
            N/A
          </Typography>
        );
      }
      return (
        <Chip
          variant="filled"
          label={`${displayBNValue(optimalBDVPct, '0')}%`}
          sx={{
            ...chipSx,
            background: Palette.lightestGreen,
            color: Palette.winterGreen,
          }}
        />
      );
    },
  },
  {
    key: 'currentLPBDVPct',
    header: 'Current LP BDV %',
    render: ({ optimalBDVPct, currentBDVPct, gaugePoints }) => {
      if (!gaugePoints || gaugePoints.eq(0)) {
        return (
          <Typography variant="bodySmall" color="text.tertiary">
            N/A
          </Typography>
        );
      }
      const isOptimal = currentBDVPct.eq(optimalBDVPct);

      return (
        <Chip
          variant="filled"
          label={`${displayBNValue(currentBDVPct, '0')}%`}
          sx={{
            ...chipSx,
            color: isOptimal ? Palette.winterGreen : Palette.theme.winter.red,
            background: isOptimal ? Palette.lightestGreen : Palette.lightestRed,
          }}
        />
      );
    },
  },
];

const basicViewColumns: ISeedGaugeColumn[] = [TokenColumn, ...BDVPctColumns];

const columns: ISeedGaugeColumn[] = [
  TokenColumn,
  {
    key: 'totalGrownStalk',
    header: 'Total grown stalk',
    render: ({ totalGrownStalk }) => (
      <Typography
        variant="bodySmall"
        color={isNonZero(totalGrownStalk) ? 'text.primary' : 'text.tertiary'}
      >
        {displayBNValue(totalGrownStalk)}
      </Typography>
    ),
  },
  {
    key: 'totalGrownStalkPerBDV',
    header: 'Total Grown Stalk per BDV',
    render: ({ totalGrownStalkPerBDV }) => (
      <Typography
        variant="bodySmall"
        color={
          isNonZero(totalGrownStalkPerBDV) ? 'text.primary' : 'text.tertiary'
        }
      >
        {displayBNValue(totalGrownStalkPerBDV)}
      </Typography>
    ),
  },
  {
    key: 'gaugePoints',
    header: 'Gauge Points',
    render: ({ gaugePoints }) => (
      <Typography
        variant="bodySmall"
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
        variant="bodySmall"
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
  const whitelist = useWhitelist();
  const poolData = useAppSelector((s) => s._bean.pools);
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

      const rowSeedData: ISeedGaugeRow = {
        token: token,
        totalGrownStalk: tokenSettings?.milestoneStem || ZERO_BN,
        totalGrownStalkPerBDV: tokenSettings?.stalkIssuedPerBdv || ZERO_BN,
        gaugePoints: tokenSettings?.gaugePoints || ZERO_BN,
        gaugePointsPerBDV: ZERO_BN, // TODO: SG: Implement this
        optimalBDVPct: tokenSettings?.optimalPercentDepositedBdv || ZERO_BN,
        currentBDVPct: tokenSettings?.currentPercentDepositedBdv || ZERO_BN, // TODO: SG: Implement this
        deltaStalkPerSeason: tokenSettings?.deltaStalkEarnedPerSeason,
      };

      return rowSeedData;
    });

    return mappedData;
  }, [sdk, advancedView, gaugeData?.tokenSettings]);

  return rowData;
};

// TODO: SG: FIX ME
const ExpectedSeedRewardDirection = (row: ISeedGaugeRow) => {
  const optimal = row.optimalBDVPct?.eq(row.currentBDVPct);

  if (!row.gaugePoints || row.gaugePoints.lte(0) || optimal) {
    return null;
  }

  const isBelow = row.currentBDVPct?.lt(row.optimalBDVPct);
  // const decreasing = rowSeedData.deltaStalkPerSeason?.lt(0);

  const direction = isBelow ? 'increase' : 'decrease';
  const Arrow = isBelow ? ArrowUpward : ArrowDownward;
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      alignItems="center"
      pr={{ xs: 2, md: 4 }}
      gap={0.25}
      sx={(theme) => ({
        // don't display this on mobile
        [theme.breakpoints.down('sm')]: { display: 'none' },
      })}
    >
      <Arrow sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
      <Typography color="text.secondary" variant="bodySmall">
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

const SeedGaugeTable = ({
  data,
}: {
  data: ReturnType<typeof useSeedGauge>['data'];
}) => {
  const [isAdvanced, show, hide] = useToggle();
  const rows = useTableConfig(isAdvanced, data);
  const cols = isAdvanced ? columns : basicViewColumns;

  return (
    <Stack>
      <Box sx={{ borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Stack px={2}>
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
                [breakpoints.down('md')]: {
                  display: 'none',
                },
              })}
            />
          </Stack>
          <Stack pt={1} pb={1.5} px={1}>
            {/* Headers */}
            <Grid container direction="row" spacing={1}>
              {cols.map((column) => (
                <GridColumn
                  column={column}
                  isAdvanced={isAdvanced}
                  key={`sg-header-${column.key}`}
                >
                  <Tooltip title={column.headerTooltip || ''}>
                    <Typography
                      variant="bodySmall"
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
          <Card
            key={`seed-gauge-row-${i}-${row.token.symbol}`}
            sx={{
              borderWidth: '0.5px',
              borderColor: 'divider',
            }}
          >
            <Stack py={1}>
              <Grid container px={2}>
                {cols.map((column, j) => (
                  <GridColumn
                    column={column}
                    isAdvanced={isAdvanced}
                    key={`sgr-${i}-${row.token.symbol}-${j}`}
                  >
                    <Stack direction="row" alignItems="center">
                      {column.render(row)}
                      {/* render the right arrow if last column */}
                      {j === cols.length - 1 ? (
                        <Stack
                          display={{ xs: 'none', md: 'block' }}
                          sx={{ width: '20px' }}
                          alignItems="center"
                        >
                          <ArrowRight
                            sx={{
                              position: 'relative',
                              color: 'secondary.main',
                              top: '3px',
                              marginRight: '-3px',
                            }}
                          />
                        </Stack>
                      ) : null}
                    </Stack>
                  </GridColumn>
                ))}
              </Grid>
              <ExpectedSeedRewardDirection {...row} />
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
};

export default SeedGaugeTable;
