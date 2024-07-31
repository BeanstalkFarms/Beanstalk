import React from 'react';
import { Typography, Box, Grid, Stack } from '@mui/material';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { SeasonSummary } from '~/hooks/beanstalk/useSeasonsSummary';
import { FontSize } from '../App/muiTheme';
import { SeasonSummaryColumn } from '../Nav/Buttons/SunButton';

export type SeasonCardProps = {
  // pass in index to ensure that the key is unique
  index: number;
  summary: SeasonSummary;
  columns: Record<string, SeasonSummaryColumn>;
  isNew?: boolean;
};

const SeasonCard: FC<SeasonCardProps> = ({
  index,
  summary,
  columns,
  isNew = false,
}) => (
  <Box>
    <Box
      sx={{
        '&:hover > .next-season': { display: 'block' },
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {isNew && (
        <Box
          className="next-season"
          sx={{
            borderColor: 'rgba(240, 223, 146, 1)',
            borderWidth: 0.5,
            borderStyle: 'solid',
            display: 'none',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            borderRadius: 1,
            backgroundColor: 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Row justifyContent="center" height="100%">
            <Typography
              pl={1}
              fontSize={FontSize.sm}
              textAlign="left"
              color="text.primary"
            >
              The forecast for Season {summary.season.value?.toString() || '--'}{' '}
              is based on data in the current Season.
            </Typography>
          </Row>
        </Box>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          p: 0.75,
          borderRadius: '8px',
          animation: isNew ? 'pulse 1s ease-in-out' : undefined,
          animationIterationCount: 'infinite',
        }}
      >
        <Grid container>
          {Object.values(columns).map((col, i) => (
            <Grid key={`season-card-${index}-${i}`} item {...col.widths}>
              <Stack height="100%" justifyContent="center">
                {col.render(summary)}
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  </Box>
);

export default SeasonCard;

// <Grid container>
//             {/* Season */}
//             <Grid item xs={1.5} md={1.25}>
//               <Row justifyContent="flex-start" spacing={0.5}>
//                 {beanMints && beanMints.value?.lte(0) ? (
//                   <img src={drySeasonIcon} height={IconSize.small} alt="" />
//                 ) : (
//                   <img src={rainySeasonIcon} height={IconSize.small} alt="" />
//                 )}
//                 <Typography variant="bodySmall">
//                   {season.value?.toString() || '-'}
//                 </Typography>
//               </Row>
//             </Grid>
//             // {/* New Beans */}
//             <Grid item xs={3} md={2} textAlign="right">
//               <Typography variant="bodySmall">
//                 {beanMints.value ? `+ ${displayBN(beanMints.value)}` : '-'}
//               </Typography>
//             </Grid>
//             // {/* Soil */}
//             <Grid item xs={3} md={2} textAlign="right">
//               <Typography variant="bodySmall">
//                 {maxSoil.value
//                   ? maxSoil.value.lt(0.01)
//                     ? '<0.01'
//                     : displayFullBN(maxSoil.value, 2, 2)
//                   : '-'}
//               </Typography>
//             </Grid>
//             // {/* Temperature */}
//             <Grid item xs={4.5} md={2.75}>
//               <Row justifyContent="flex-end" spacing={0.5}>
//                 <Typography variant="bodySmall">
//                   {maxTemperature.value
//                     ? `${displayBN(maxTemperature.value)}%`
//                     : '-'}
//                 </Typography>
//                 <Typography
//                   variant="bodySmall"
//                   color="text.secondary"
//                   sx={{ whiteSpace: 'nowrap' }}
//                 >
//                   (&nbsp;
//                   {maxTemperature.delta && maxTemperature.delta.lt(0)
//                     ? '-'
//                     : '+'}
//                   {maxTemperature.delta?.abs().toString() || '0'}%&nbsp;)
//                 </Typography>
//               </Row>
//             </Grid>
//             // {/* Pod Rate */}
//             <Grid
//               item
//               xs={0}
//               md={2}
//               display={{ xs: 'none', md: 'block' }}
//               textAlign="right"
//             >
//               <Typography color="text.primary" variant="bodySmall">
//                 {podRate.value?.gt(0)
//                   ? `${displayBN(podRate.value.times(100))}%`
//                   : '-'}
//               </Typography>
//             </Grid>
//             // {/* Delta Demand */}
//             <Grid
//               item
//               xs={0}
//               md={2}
//               display={{ xs: 'none', md: 'block' }}
//               textAlign="right"
//             >
//               <Typography variant="bodySmall">
//                 {deltaPodDemand.value
//                   ? deltaPodDemand?.value.lt(-10_000 / 100) ||
//                     deltaPodDemand.value.gt(10_000 / 100)
//                     ? `${deltaPodDemand.value.lt(0) ? '-' : ''}∞`
//                     : `${displayBN(deltaPodDemand.value.div(100), true)}%`
//                   : '-'}
//               </Typography>
//             </Grid>
//           </Grid>
