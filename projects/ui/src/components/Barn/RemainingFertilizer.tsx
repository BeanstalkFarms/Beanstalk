import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Card, Stack, Typography, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import useHumidity from '~/hooks/beanstalk/useHumidity';
import SunriseCountdown from '~/components/Sun/SunriseCountdown';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import { displayFullBN } from '~/util';
import FertilizerImage from './FertilizerImage';
import { FontSize } from '../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const RemainingFertilizer: FC<{}> = () => {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [humidity, nextDecreaseAmount] = useHumidity();
  const { recapFundedPct, remaining } = useSelector<AppState, AppState['_beanstalk']['barn']>((state) => state._beanstalk.barn);
  const season = useSeason();
  
  // eslint-disable-next-line unused-imports/no-unused-vars
  const nextDecreaseTimeString = season.eq(6074)
    ? 'per Season upon Unpause'
    :  <SunriseCountdown />;

  return (
    <Card sx={{ p: 2 }}>
      <Stack gap={1}>
        <Typography variant="h4">Barn Conditions</Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'left', md: 'stretch' }}
          justifyContent={{ md: 'left' }}
          gap={3}
        >
          {/* left column */}
          <Box sx={{ width: 130, display: { xs: 'none', md: 'block' }, aspectRatio: '1/1' }}>
            <FertilizerImage progress={Math.max(recapFundedPct.toNumber(), 0.05)} />
          </Box>
          {/* right column */}
          <Stack justifyContent="space-between" gap={2}>
            <Stack gap={0.5}>
              <Tooltip
                title="The number of Fertilizer that can be bought from Beanstalk in exchange for 1 USDC each."
                placement="bottom"
              >
                <Typography variant="body1">
                  Available Fertilizer&nbsp;
                  <HelpOutlineIcon
                    sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                  />
                </Typography>
              </Tooltip>

              <Row gap={1} alignItems="center">
                <Typography
                  display="inline-block"
                  variant="bodyLarge"
                  sx={{ fontWeight: 400 }}
                >
                  {displayFullBN(remaining, 0)}&nbsp;
                </Typography>
                {recapFundedPct.gt(0) ? (
                  <Typography
                    display="inline-block"
                    variant="bodySmall"
                    color="primary"
                  >
                    {displayFullBN(recapFundedPct.times(100), 2)}% Recapitalized
                  </Typography>
                ) : null}
              </Row>
            </Stack>
            <Stack gap={0.5}>
              <Tooltip
                title="The interest rate on Fertilizer. The Humidity determines how many Sprouts come with Fertilizer."
                placement="bottom"
              >
                <Typography>
                  Humidity&nbsp;
                  <HelpOutlineIcon
                    sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                  />
                </Typography>
              </Tooltip>
              <Row alignItems="center" gap={1}>
                <Typography variant="bodyLarge">
                  {displayFullBN(humidity.multipliedBy(100))}%
                </Typography>
              </Row>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
};

export default RemainingFertilizer;
