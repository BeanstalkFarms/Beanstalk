import React, { useMemo } from 'react';
import {
  ButtonProps,
  Stack,
  Typography,
  useMediaQuery,
  Box,
  Grid,
  Divider,
} from '@mui/material';
import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import drySeasonIcon from '~/img/beanstalk/sun/dry-season.svg';
import rainySeasonIcon from '~/img/beanstalk/sun/rainy-season.svg';
import SunriseButton from '~/components/Sun/SunriseButton';
import { SunButtonQuery, useSunButtonQuery } from '~/generated/graphql';
import usePrice from '~/hooks/beanstalk/usePrice';
import useSeason from '~/hooks/beanstalk/useSeason';
import { toTokenUnitsBN } from '~/util';
import { BEAN } from '~/constants/tokens';
import { NEW_BN } from '~/constants';
import { AppState } from '~/state';
import FolderMenu from '../FolderMenu';
import SeasonCard from '../../Sun/SeasonCard';
import usePeg from '~/hooks/beanstalk/usePeg';

import { FC } from '~/types';

const castField = (data: SunButtonQuery['fields'][number]) => ({
  season:   new BigNumber(data.season),
  issuedSoil:  toTokenUnitsBN(data.issuedSoil, BEAN[1].decimals),
  temperature: new BigNumber(data.temperature),
  podRate:  new BigNumber(data.podRate),
});
const castSeason = (data: SunButtonQuery['seasons'][number]) => ({
  season:      new BigNumber(data.season),
  price:       new BigNumber(data.price),
  rewardBeans: toTokenUnitsBN(
    data.season <= 6074
      ? data.deltaBeans
      : data.rewardBeans,
    BEAN[1].decimals
  ),
});

const MAX_ITEMS = 8;

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  /// DATA
  const season    = useSeason();
  const price     = usePrice();
  const awaiting  = useSelector<AppState, boolean>((state) => state._beanstalk.sun.sunrise.awaiting);
  const { data }  = useSunButtonQuery({ fetchPolicy: 'cache-and-network' });
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>((state) => state._beanstalk.field);
  const peg = usePeg();

  const bySeason = useMemo(() => {
    if (data?.fields && data?.seasons) {
      type MergedSeason = (
        ReturnType<typeof castField>
        & ReturnType<typeof castSeason>
      );

      // Build mapping of season => data
      const merged : { [key: number] : MergedSeason } = {};
      data.fields.forEach((_f) => {
        // fixme: need intermediate type?
        // @ts-ignore
        if (_f) merged[_f.season] = { ...castField(_f) };
      });
      data.seasons.forEach((_s) => {
        if (_s) merged[_s.season] = { ...merged[_s.season], ...castSeason(_s) };
      });

      // Sort latest season first and return as array
      return (
        Object.keys(merged)
          .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
          .reduce<MergedSeason[]>((prev, curr) => {
            prev.push(merged[curr as unknown as number]);
            return prev;
          }, [])
      );
    }
    return [];
  }, [data]);

  /// Theme
  const isTiny = useMediaQuery('(max-width:350px)');

  /// Button Content
  const isLoading = season.eq(NEW_BN);
  const startIcon = isTiny ? undefined : (
    <img
      src={price.lte(1) || awaiting ? drySeasonIcon : rainySeasonIcon}
      css={{
        width: 25,
        height: 25,
        animationName: awaiting ? 'rotate' : 'none',
        animationTimingFunction: 'linear',
        animationDuration: '3000ms',
        animationIterationCount: 'infinite'
      }}
      alt=""
    />
  );

  /// Table Content
  const tableContent = (
    <Box sx={{ overflow: 'hidden' }}>
      {/* Past Seasons */}
      <Stack
        gap={1}
        sx={{
          width: '100%',
          pt: 1,
          px: 1,
          maxHeight: `${(37.5 + 10) * MAX_ITEMS - 10}px`,
          overflowY: 'auto',
        }}
      >
        {/* table header */}
        <Box px={1}>
          <Grid container>
            <Grid item xs={1.5} md={1.25}>
              <Typography variant="bodySmall">
                Season
              </Typography>
            </Grid>
            <Grid item xs={3} md={2} textAlign="right">
              <Typography variant="bodySmall">
                New Beans
              </Typography>
            </Grid>
            <Grid item xs={3} md={2} textAlign="right">
              <Typography variant="bodySmall">
                Soil
              </Typography>
            </Grid>
            <Grid item xs={4} md={2.75}>
              <Stack alignItems="flex-end">
                <Typography variant="bodySmall">
                  Temperature
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={0} md={2} display={{ xs: 'none', md: 'block' }} textAlign="right">
              <Typography variant="bodySmall">
                Pod Rate
              </Typography>
            </Grid>
            <Grid item xs={0} md={2} display={{ xs: 'none', md: 'block' }} textAlign="right">
              <Typography variant="bodySmall">
                Delta Demand
              </Typography>
            </Grid>
          </Grid>
        </Box>
        <SeasonCard
          season={season.plus(1)}
          rewardBeans={peg.rewardBeans}
          issuedSoil={peg.soilStart}
          podRate={NEW_BN}
          temperature={beanstalkField.weather.yield.plus(peg.deltaTemperature)} // FIXME expected
          deltaDemand={peg.deltaPodDemand}
          deltaTemperature={peg.deltaTemperature}
          isNew
        />
        {bySeason.map((s, i) => {
          const deltaTemperature = (bySeason[i + 1]?.temperature && s.temperature)
            ? s.temperature.minus(bySeason[i + 1].temperature)
            : undefined;
          return (
            <SeasonCard
              key={s.season.toString()}
              season={s.season}
              // Season
              rewardBeans={s.rewardBeans}
              // Field
              temperature={s.temperature}
              deltaTemperature={deltaTemperature}
              deltaDemand={undefined}
              issuedSoil={s.issuedSoil}
              podRate={s.podRate}
            />
          );
        })}
      </Stack>
      <Divider sx={{ borderBottomWidth: 0, borderColor: 'divider' }} />
      <Box sx={{ p: 1 }}>
        <SunriseButton />
      </Box>
    </Box>
  );

  return (
    <FolderMenu
      startIcon={startIcon}
      buttonContent={<>{isLoading ? '0000' : season.toFixed()}</>}
      drawerContent={<Box sx={{ p: 1 }}>{tableContent}</Box>}
      popoverContent={tableContent}
      hideTextOnMobile
      popperWidth="700px"
      hotkey="opt+2, alt+2"
      zIndex={997}
      {...props}
    />
  );
};

export default PriceButton;
