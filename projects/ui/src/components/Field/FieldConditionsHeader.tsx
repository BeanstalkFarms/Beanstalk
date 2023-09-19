import React from 'react';

import { Stack, Typography } from '@mui/material';

import { useSelector } from 'react-redux';
import { FontWeight } from '~/components/App/muiTheme';
import { selectMorning } from '~/state/beanstalk/sun';
import useSeason from '~/hooks/beanstalk/useSeason';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';

const FieldConditionsHeader: React.FC<{}> = () => {
  const { interval, isMorning } = useSelector(selectMorning);
  const season = useSeason();

  if (isMorning) {
    return (
      <Stack gap={0.2}>
        <Typography variant="h4" fontWeight={FontWeight.bold}>
          🌤️ Morning: Block {interval.toString()} of {BLOCKS_PER_MORNING},
          Season
          <Typography
            variant="inherit"
            component="span"
            sx={{ whiteSpace: 'nowrap' }}
          >
            &nbsp;
            {season.gt(0) && season.toString()}
          </Typography>
        </Typography>
        <Typography color="text.secondary">
          Temperature increases during the Morning each Season.
        </Typography>
      </Stack>
    );
  }

  return (
    <Typography variant="h4" fontWeight={FontWeight.bold}>
      🌤️ Field Conditions, Season {season.gt(0) && season.toString()}
    </Typography>
  );
};

export default FieldConditionsHeader;
