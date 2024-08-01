import React from 'react';
import {
  ButtonProps,
  Stack,
  Grid,
  Divider,
  Breakpoint,
  GridProps,
  Typography,
  Box,
  useTheme,
} from '@mui/material';
import BigNumber from 'bignumber.js';
import drySeasonIcon from '~/img/beanstalk/sun/dry-season.svg';
import rainySeasonIcon from '~/img/beanstalk/sun/rainy-season.svg';
import useSeason from '~/hooks/beanstalk/useSeason';
import { NEW_BN } from '~/constants';
import { useAppSelector } from '~/state';
import { FC } from '~/types';
import useSeasonsSummary, {
  SeasonSummary,
} from '~/hooks/beanstalk/useSeasonsSummary';
import Row from '~/components/Common/Row';
import { IconSize } from '~/components/App/muiTheme';
import SunriseButton from '~/components/Sun/SunriseButton';
import FolderMenu from '../FolderMenu';
import SeasonCard from '../../Sun/SeasonCard';

type GridConfigProps = Pick<GridProps, Breakpoint>;

export type SeasonSummaryColumn = {
  title: string;
  widths: GridConfigProps;
  subtitle?: string;
  align?: 'left' | 'right';
  render: (d: SeasonSummary) => string | JSX.Element;
};

const getDelta = (value: BigNumber | undefined) => {
  if (!value) return '';
  return value.gte(0) ? '+' : '-';
};

const colConfig: Record<string, SeasonSummaryColumn> = {
  season: {
    title: 'Season',
    align: 'left',
    widths: { xs: 0.65 },
    render: ({ beanMints, season }) => (
      <Row justifyContent="flex-start" spacing={0.5} height="100%">
        {beanMints.value && beanMints.value?.lte(0) ? (
          <img src={drySeasonIcon} height={IconSize.small} alt="" />
        ) : (
          <img src={rainySeasonIcon} height={IconSize.small} alt="" />
        )}
        <Typography variant="bodySmall">
          {season.value?.toString() || '-'}
        </Typography>
      </Row>
    ),
  },
  beanMints: {
    title: 'New Beans',
    subtitle: 'Beans minted',
    widths: { xs: 1.15 },
    render: ({ beanMints: { value } }) => (
      <Stack justifyContent="center" height="100%">
        <Typography variant="bodySmall" align="right">
          {`+${value?.abs().toFormat(0) || 0}`}
        </Typography>
      </Stack>
    ),
  },
  maxSoil: {
    title: 'Max Soil',
    subtitle: 'Max debt to auction',
    widths: { xs: 1.35 },
    render: ({ maxSoil }) => (
      <Typography variant="bodySmall" align="right">
        {maxSoil.value?.abs().toFormat(2) || 0}
      </Typography>
    ),
  },
  maxTemperature: {
    title: 'Max Temperature',
    subtitle: 'Max interest of debt at auction',
    widths: { xs: 1.65 },
    render: ({ maxTemperature }) => (
      <Stack justifyContent="center" alignItems="flex-end">
        <Typography variant="bodySmall" align="right">
          {maxTemperature.value?.abs().toFormat(0) || '-'}%{' '}
          <Typography
            component="span"
            variant="bodySmall"
            color="text.secondary"
          >
            {`(${getDelta(maxTemperature.delta)}${maxTemperature?.delta?.abs().toFormat() || '-'}%)`}
          </Typography>
        </Typography>
        {maxTemperature.display && (
          <Typography variant="bodySmall" align="right" color="text.tertiary">
            {maxTemperature.display}
          </Typography>
        )}
      </Stack>
    ),
  },
  bean2MaxLPScalar: {
    title: 'Bean:Max LP Scalar',
    subtitle: 'Relative reward for Dep. Bean',
    widths: { xs: 1.65 },
    render: ({ bean2MaxLPScalar }) => (
      <Stack justifyContent="center" alignItems="flex-end">
        <Typography variant="bodySmall" align="right">
          {bean2MaxLPScalar.value?.toFormat() || '-'}%{' '}
          {bean2MaxLPScalar.value && (
            <Typography
              component="span"
              variant="bodySmall"
              color="text.secondary"
            >
              {`(${getDelta(bean2MaxLPScalar.delta)}${
                bean2MaxLPScalar?.delta?.div(100).abs().toFormat() || '-'
              })`}
            </Typography>
          )}
        </Typography>
        {bean2MaxLPScalar.display && (
          <Typography variant="bodySmall" align="right" color="text.tertiary">
            {bean2MaxLPScalar.display}
          </Typography>
        )}
      </Stack>
    ),
  },
  price: {
    title: 'Price',
    subtitle: 'Price of Bean',
    widths: { xs: 1.5 },
    render: ({ price }) => (
      <Stack justifyContent="center" alignItems="flex-end">
        <Typography variant="bodySmall" align="right">
          ${price.value?.toFixed(2) || '-'}
        </Typography>
        <Typography variant="bodySmall" color="text.tertiary" align="right">
          {price.display || '-'}
        </Typography>
      </Stack>
    ),
  },
  l2sr: {
    title: 'Liquidity to Supply Ratio',
    subtitle: 'Amount of Liquidity / Supply',
    widths: { xs: 1.7 },
    render: ({ l2sr }) => (
      <Stack justifyContent="center" alignItems="flex-end">
        <Typography variant="bodySmall" align="right">
          {l2sr.value?.times(100).toFormat(0) || '-'}%
        </Typography>
        <Typography variant="bodySmall" color="text.tertiary" align="right">
          {l2sr.display || '-'}
        </Typography>
      </Stack>
    ),
  },
  podRate: {
    title: 'Pod Rate',
    subtitle: 'Debt ratio',
    widths: { xs: 1.25 },
    render: ({ podRate }) => (
      <Stack justifyContent="center" alignItems="flex-end">
        <Typography variant="bodySmall" align="right">
          {`${podRate.value?.times(100).toFormat(0) || '-'}%`}
        </Typography>
        <Typography variant="bodySmall" color="text.tertiary" align="right">
          {podRate.display || '-'}
        </Typography>
      </Stack>
    ),
  },
  deltaPodDemand: {
    title: 'Delta Demand',
    subtitle: 'Change in Soil',
    widths: { xs: 1.1 },
    render: ({ deltaPodDemand }) => (
      <Stack justifyContent="center" alignItems="flex-end">
        <Typography variant="bodySmall" color="text.tertiary" align="right">
          {deltaPodDemand.display || '-'}
        </Typography>
      </Stack>
    ),
  },
};

const MAX_ITEMS = 5;

const MAX_TABLE_WIDTH = 1568;

const SeasonTable = ({
  forecast: nextSeasonForecast,
  seasonsSummary,
}: ReturnType<typeof useSeasonsSummary>) => (
  <Box
    sx={(t) => ({
      position: 'relative',
      width: `min(calc(100vw - 20px), ${MAX_TABLE_WIDTH}px)`,
      [t.breakpoints.up('lg')]: {
        width: `min(calc(100vw - 40px), ${MAX_TABLE_WIDTH}px)`,
      },
    })}
  >
    <Stack gap={1}>
      <Stack gap={1} px={1} pt={1}>
        <Box sx={{ overflowX: 'auto' }}>
          <Stack gap={1} sx={{ minWidth: `${MAX_TABLE_WIDTH - 20}px` }}>
            {/* Header */}
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: 'white',
              }}
            >
              <Grid container px={1}>
                {Object.values(colConfig).map((col) => (
                  <Grid
                    item
                    key={`sun-button-table-header-${col.title}`}
                    {...col.widths}
                  >
                    <Stack justifyContent="center">
                      <Typography
                        variant="bodySmall"
                        align={col.align || 'right'}
                      >
                        {col.title}
                      </Typography>
                      {col.subtitle && (
                        <Typography
                          color="text.tertiary"
                          variant="bodySmall"
                          align={col.align || 'right'}
                        >
                          {col.subtitle}
                        </Typography>
                      )}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Box>
            {/* Rows */}
            <Stack
              gap={1}
              sx={{
                maxHeight: `${(57 + 10) * MAX_ITEMS}px`,
                overflowY: 'auto',
              }}
            >
              <SeasonCard
                index={-1}
                summary={nextSeasonForecast}
                columns={colConfig}
                isNew
              />
              {seasonsSummary.map((summary, i) => (
                <SeasonCard
                  key={`season-card-row-${i}`}
                  index={i}
                  summary={summary}
                  columns={colConfig}
                />
              ))}
            </Stack>
          </Stack>
        </Box>
      </Stack>
      <Divider sx={{ borderBottomWidth: 0, borderColor: 'divider' }} />
      <Box px={1} pb={1}>
        <SunriseButton />
      </Box>
    </Stack>
  </Box>
);

const SeasonIcon = ({ beanMints }: { beanMints: BigNumber | undefined }) => {
  const awaiting = useAppSelector((s) => s._beanstalk.sun.sunrise.awaiting);
  return (
    <Box
      sx={{
        '@media (max-width: 350px)': {
          display: 'none',
        },
      }}
    >
      <img
        src={beanMints?.eq(0) || awaiting ? drySeasonIcon : rainySeasonIcon}
        css={{
          width: 25,
          height: 25,
          animationName: awaiting ? 'rotate' : 'none',
          animationTimingFunction: 'linear',
          animationDuration: '3000ms',
          animationIterationCount: 'infinite',
        }}
        alt=""
      />
    </Box>
  );
};

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  /// DATA
  const season = useSeason();
  const theme = useTheme();
  const summary = useSeasonsSummary();

  /// Button Content
  const isLoading = season.eq(NEW_BN) || summary.loading;

  return (
    <FolderMenu
      startIcon={
        <SeasonIcon beanMints={summary.seasonsSummary?.[0]?.beanMints.value} />
      }
      buttonContent={<>{isLoading ? '0000' : season.toFixed()}</>}
      drawerContent={
        <Box sx={{ p: 1 }}>
          <SeasonTable {...summary} />
        </Box>
      }
      popoverContent={<SeasonTable {...summary} />}
      hideTextOnMobile
      popperWidth="100%"
      hotkey="opt+2, alt+2"
      zIndex={100}
      zeroTopLeftRadius
      zeroTopRightRadius
      popperSx={{
        [`@media (min-width: ${theme.breakpoints.values.lg - 1}px)`]: {
          paddingRight: '20px',
        },
      }}
      {...props}
    />
  );
};

export default PriceButton;
