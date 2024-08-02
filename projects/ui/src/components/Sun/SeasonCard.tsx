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
