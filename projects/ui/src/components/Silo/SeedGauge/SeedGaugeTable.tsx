import React, { useMemo } from 'react';
import {
  Breakpoint,
  Card,
  Chip,
  Divider,
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
  //   gridConfigProps: { advanced?: GridConfigProps; basic: GridConfigProps };
  render: (data: ISeedGaugeRow) => string | JSX.Element;
  align?: 'left' | 'right';
  mobileAlign?: 'left' | 'right';
  hideMobile?: boolean;
  hideTablet?: boolean;
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
  }
> = {
  token: {
    advanced: { xs: 2, lg: 2 },
    basic: { xs: 4 },
  },
  totalGrownStalk: {
    advanced: { lg: 1.5 },
  },
  totalGrownStalkPerBDV: {
    advanced: { lg: 2 },
  },
  gaugePoints: {
    advanced: { lg: 1.5 },
  },
  gaugePointsPerBDV: {
    advanced: { lg: 1.5 },
  },
  optimalBDVPct: {
    advanced: { xs: 4, lg: 1.5 },
    basic: { xs: 4 },
  },
  currentBDVPct: {
    basic: { xs: 4 },
    advanced: { xs: 3 },
  },
};

const TokenColumn: ISeedGaugeColumn = {
  key: 'token',
  header: 'Token',
  align: 'left',
  render: (data) => (
    <Stack direction="row" gap={0.5}>
      <TokenIcon token={data.token} />
      <Typography>{data.token.symbol}</Typography>
    </Stack>
  ),
};

const getGridConfigProps = (isAdvancedView: boolean, key: string) => {
  if (!(key in GridConfig)) return { show: false, config: {} };

  const configKey = isAdvancedView ? 'advanced' : 'basic';
  const configItem = GridConfig[key][configKey];

  return {
    visible: !!configItem,
    config: configItem || {},
  };
};

const basicViewColumns: ISeedGaugeColumn[] = [
  TokenColumn,
  {
    key: 'optimalBDVPct',
    header: 'Optimal BDV %',
    render: ({ optimalBDVPct }) => (
      <Chip
        variant="filled"
        label={`${displayBNValue(optimalBDVPct, '0')}%`}
        sx={{
          fontSize: '14px', // set manually
          lineHeight: '17px', // set manually
          background: Palette.lightestGreen,
          color: Palette.winterGreen,
        }}
      />
    ),
  },
  {
    key: 'currentBDVPct',
    header: 'Current BDV %',
    render: ({ optimalBDVPct, currentBDVPct }) => {
      const isOptimal = currentBDVPct.eq(optimalBDVPct);

      return (
        <Chip
          variant="filled"
          label={`${displayBNValue(currentBDVPct, '0')}%`}
          sx={{
            fontSize: '14px',
            lineHeight: '17px',
            color: isOptimal ? Palette.winterGreen : Palette.theme.winter.red,
            background: isOptimal ? Palette.lightestGreen : Palette.lightestRed,
          }}
        />
      );
    },
  },
];

const columns: ISeedGaugeColumn[] = [
  TokenColumn,
  {
    key: 'totalGrownStalk',
    header: 'Total grown stalk',
    hideMobile: true,
    hideTablet: true,
    render: ({ totalGrownStalk }) => (
      <Typography
        color={isNonZero(totalGrownStalk) ? 'text.primary' : 'text.secondary'}
      >
        {displayBNValue(totalGrownStalk)}
      </Typography>
    ),
  },
  {
    key: 'totalGrownStalkPerBDV',
    header: 'Total Grown Stalk per BDV',
    hideMobile: true,
    hideTablet: true,
    render: ({ totalGrownStalkPerBDV }) => (
      <Typography
        color={
          isNonZero(totalGrownStalkPerBDV) ? 'text.primary' : 'text.secondary'
        }
      >
        {displayBNValue(totalGrownStalkPerBDV)}
      </Typography>
    ),
  },
  {
    key: 'gaugePoints',
    header: 'Gauge Points',
    hideMobile: true,
    hideTablet: true,
    render: ({ gaugePoints }) => (
      <Typography
        color={isNonZero(gaugePoints) ? 'text.primary' : 'text.secondary'}
      >
        {displayBNValue(gaugePoints)}
      </Typography>
    ),
  },
  {
    key: 'gaugePointsPerBDV',
    header: 'Gauge Points per BDV',
    hideMobile: true,
    hideTablet: true,
    render: ({ gaugePointsPerBDV }) => (
      <Typography
        color={isNonZero(gaugePointsPerBDV) ? 'text.primary' : 'text.secondary'}
      >
        {displayBNValue(gaugePointsPerBDV)}
      </Typography>
    ),
  },
  {
    key: 'optimalBDVPct',
    header: 'Optimal BDV %',
    render: ({ optimalBDVPct }) => (
      <Typography
        color={isNonZero(optimalBDVPct) ? 'text.primary' : 'text.secondary'}
      >
        {displayBNValue(optimalBDVPct)}
      </Typography>
    ),
  },
  {
    key: 'currentBDVPct',
    header: 'Current BDV %',
    render: ({ currentBDVPct }) => (
      <Typography
        color={isNonZero(currentBDVPct) ? 'text.primary' : 'text.secondary'}
      >
        {displayBNValue(currentBDVPct)}
      </Typography>
    ),
  },
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
        currentBDVPct: ZERO_BN, // TODO: SG: Implement this
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
  if (row.optimalBDVPct.lte(0)) return null;

  const increasing = row.deltaStalkPerSeason?.gt(0);
  // const decreasing = rowSeedData.deltaStalkPerSeason?.lt(0);

  const direction = increasing ? 'increase' : 'decrease';
  const Arrow = increasing ? ArrowUpward : ArrowDownward;
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      alignItems="center"
      pr={4}
      gap={0.25}
    >
      <Arrow sx={{ fontSize: 'inherit', color: 'text.secondary' }} />
      <Typography color="text.secondary">
        Expected Seed Reward {direction} next Season
      </Typography>
    </Stack>
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
      <Stack px={2}>
        <Stack pt={1.5} direction="row" alignItems="center" gap={1}>
          <Typography>Show additional information</Typography>
          <Switch
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
        <Stack
          pb={1.5}
          px={1} // add 10px padding on x for alignment
        >
          {/*
           * Headers
           */}
          <Grid container direction="row" spacing={1}>
            {cols.map((column) => {
              const { visible, config: gridConfig } = getGridConfigProps(
                isAdvanced,
                column.key
              );

              if (!visible) return null;
              return (
                <Grid
                  item
                  display="flex"
                  justifyContent={
                    column.align === 'left' ? 'flex-start' : 'flex-end'
                  }
                  textAlign={column.align}
                  zeroMinWidth
                  {...gridConfig}
                  sx={({ breakpoints: bp }) => ({
                    [bp.down('md')]: {
                      textAlign: column.mobileAlign || 'right',
                      alignItems: column.mobileAlign || 'right',
                      display: column.hideMobile ? 'none' : 'block',
                    },
                    [bp.between('md', 'lg')]: {
                      display: column.hideTablet ? 'none' : 'block',
                    },
                  })}
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
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </Stack>
      <Divider />
      <Stack p={1} gap={1}>
        {rows.map((row, i) => (
          <Card
            key={`seed-gauge-row-${i}-${row.token.symbol}`}
            sx={{
              borderWidth: '0.5px',
              borderColor: 'divider',
            }}
          >
            <Stack py={1} gap={0.5}>
              <Grid container px={2}>
                {cols.map((column, j) => {
                  const { visible, config: gridConfig } = getGridConfigProps(
                    isAdvanced,
                    column.key
                  );
                  if (!visible) return null;
                  return (
                    <Grid
                      item
                      key={`seed-gauge-col-${i}-${j}`}
                      {...gridConfig}
                      sx={({ breakpoints: bp }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                          column.align === 'left' ? 'flex-start' : 'flex-end',
                        [bp.down('md')]: {
                          textAlign: column.mobileAlign || 'right',
                          alignItems: column.mobileAlign || 'right',
                          display: column.hideMobile ? 'none' : 'block',
                        },
                        [bp.between('md', 'lg')]: {
                          display: column.hideTablet ? 'none' : 'block',
                        },
                      })}
                    >
                      <Stack direction="row" alignItems="center">
                        {column.render(row)}
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
                    </Grid>
                  );
                })}
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
