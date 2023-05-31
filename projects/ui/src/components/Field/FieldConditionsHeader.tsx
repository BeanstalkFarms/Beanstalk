import React from 'react';

import { Box, Stack, Typography } from '@mui/material';

import { useSelector } from 'react-redux';
import { FontWeight } from '~/components/App/muiTheme';
import useSeason from '~/hooks/beanstalk/useSeason';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';
import { AppState } from '~/state';
import { Sun } from '~/state/beanstalk/sun';
import Row from '~/components/Common/Row';

const FieldConditionsHeader: React.FC<{
  toggled: boolean;
  toggleMorning: () => void;
}> = ({ toggled, toggleMorning }) => {
  const morning = useSelector<AppState, Sun['morning']>(
    (state) => state._beanstalk.sun.morning
  );
  const season = useSeason();
  const interval = morning.index.plus(1).toString();

  if (morning.isMorning) {
    return (
      <Stack gap={0.2}>
        <Typography variant="h4" fontWeight={FontWeight.bold}>
          🌤️ Morning: Block {interval} of {BLOCKS_PER_MORNING}, Season
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
    <Row gap={0.2} width="100%" justifyContent="space-between">
      <Typography variant="h4" fontWeight={FontWeight.bold}>
        🌤️ Field Conditions, Season {season.gt(0) && season.toString()}
      </Typography>
      <Box onClick={toggleMorning}>
        <Typography
          sx={{
            cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          {toggled
            ? 'View Normal Field Conditions'
            : 'View Morning Field Conditions'}
        </Typography>
      </Box>
    </Row>
  );
};

export default FieldConditionsHeader;
