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
} from '@mui/material';
import BigNumber from 'bignumber.js';
import drySeasonIcon from '~/img/beanstalk/sun/dry-season.svg';
import rainySeasonIcon from '~/img/beanstalk/sun/rainy-season.svg';
import SunriseButton from '~/components/Sun/SunriseButton';
import useSeason from '~/hooks/beanstalk/useSeason';
import { NEW_BN } from '~/constants';
import { useAppSelector } from '~/state';
import { FC } from '~/types';
import useSeasonsSummary, {
  SeasonSummary,
} from '~/hooks/beanstalk/useSeasonsSummary';
import Row from '~/components/Common/Row';
import { IconSize } from '~/components/App/muiTheme';
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
          {`+ ${value?.abs().toFixed(0) || '-'}`}
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
        {`+ ${maxSoil.value?.abs().toFixed(2) || '-'}`}
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
          {maxTemperature.value?.abs().toFixed(0) || '-'}{' '}
          <Typography component="span" color="text.secondary">
            {`( ${getDelta(maxTemperature.delta)} ${maxTemperature?.delta?.abs().toFixed(0) || '-'}% )`}
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
          {bean2MaxLPScalar.value?.toFixed(0) || '-'}{' '}
          {bean2MaxLPScalar.value && (
            <Typography component="span" color="text.secondary">
              {`(${getDelta(bean2MaxLPScalar.delta)}${bean2MaxLPScalar?.delta?.abs().toFixed(2) || '-'})`}
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
        <Typography align="right">{price.value?.toFixed(2) || '-'}</Typography>
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
        <Typography align="right">{l2sr.value?.toFixed(0) || '-'}</Typography>
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
        <Typography align="right">
          {`${podRate.value?.times(100).toFixed(0) || '-'}%`}
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
        <Typography color="text.tertiary" align="right">
          {deltaPodDemand.display || '-'}
        </Typography>
      </Stack>
    ),
  },
};

const MAX_ITEMS = 8;

const TABLE_WIDTH = '1568px';

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  /// DATA
  const season = useSeason();
  const awaiting = useAppSelector((s) => s._beanstalk.sun.sunrise.awaiting);

  const { seasonsSummary, forecast } = useSeasonsSummary();

  /// Button Content
  const isLoading = season.eq(NEW_BN);
  const startIcon = (
    <Box
      sx={{
        '@media (max-width: 350px)': {
          display: 'none',
        },
      }}
    >
      <img
        src={
          seasonsSummary?.[0]?.beanMints.value?.eq(0) || awaiting
            ? drySeasonIcon
            : rainySeasonIcon
        }
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

  /// Table Content
  const tableContent = (
    <Box
      sx={(t) => ({
        position: 'relative',
        [t.breakpoints.up('lg')]: {
          // 40px of padding on each side
          width: `min(calc(100vw - 40px), ${TABLE_WIDTH})`,
        },
      })}
    >
      <Stack gap={1}>
        <Box sx={{ overflowX: 'scroll' }}>
          {/* Past Seasons */}
          <Stack px={1} sx={{ minWidth: TABLE_WIDTH }}>
            {/* table header */}
            <Box
              p={1}
              sx={{
                position: 'sticky',
                left: 0,
                top: 0,
                backgroundColor: 'white',
                zIndex: 200,
              }}
            >
              <Box>
                <Grid container>
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
            </Box>
            <Stack
              gap={1}
              sx={{
                maxHeight: `${(37.5 + 10) * MAX_ITEMS - 10}px`,
                overflowY: 'auto',
              }}
            >
              <Box position="relative">
                <SeasonCard
                  index={-1}
                  summary={forecast}
                  columns={colConfig}
                  isNew
                />
              </Box>
              {Array.from({ length: 15 }).map((_, i) => (
                <SeasonCard
                  index={i}
                  columns={colConfig}
                  summary={forecast}
                  key={`season-card-row-${i}`}
                />
              ))}
            </Stack>
          </Stack>
          <Divider sx={{ borderBottomWidth: 0, borderColor: 'divider' }} />
        </Box>
        <Box
          sx={{ p: 1, display: 'flex', gap: '5px', flexDirection: 'column' }}
        >
          <SunriseButton />
        </Box>
      </Stack>
    </Box>
  );

  return (
    <FolderMenu
      startIcon={startIcon}
      buttonContent={<>{isLoading ? '0000' : season.toFixed()}</>}
      drawerContent={<Box sx={{ p: 1 }}>{tableContent}</Box>}
      popoverContent={tableContent}
      hideTextOnMobile
      popperWidth="100%"
      hotkey="opt+2, alt+2"
      zIndex={100}
      zeroTopLeftRadius
      popperSx={{
        paddingRight: '20px',
      }}
      {...props}
    />
  );
};

export default PriceButton;
