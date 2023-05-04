import React from 'react';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Stack, Typography, Tooltip, Box } from '@mui/material';

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
            {' '}
            {season.gt(0) && season.toString()}
            <Tooltip title={<Box>tooltip</Box>}>
              <HelpOutlineIcon
                sx={{
                  color: 'text.tertiary',
                  display: 'inline',
                  mb: 0.5,
                  fontSize: '11px',
                  ml: 0.25,
                }}
              />
            </Tooltip>
          </Typography>
        </Typography>
        <Typography color="text.secondary">
          Temperature and Available Soil are temporariliy adjusted during the
          Morning every Season
        </Typography>
      </Stack>
    );
  }

  return (
    <Typography variant="h4" fontWeight={FontWeight.bold}>
      🌤️ Field Conditions, Season {season.gt(0) && season.toString()}
      <Tooltip title={<Box>tooltip</Box>}>
        <HelpOutlineIcon
          sx={{
            color: 'text.tertiary',
            display: 'inline',
            mb: 0.5,
            fontSize: '11px',
          }}
        />
      </Tooltip>
    </Typography>
  );
};

export default FieldConditionsHeader;
