import React from 'react';
import { Card, CircularProgress, Grid, Stack, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useSelector } from 'react-redux';
import { displayBN, displayFullBN } from '../../util';
import { BeanstalkPalette, FontSize } from '../App/muiTheme';
import { AppState } from '~/state';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { UNRIPE_BEAN } from '~/constants/tokens';

import { FC } from '~/types';

const ChopConditions: FC<{}> = () => {
  const { fertilized, recapFundedPct, unfertilized } = useSelector<AppState, AppState['_beanstalk']['barn']>((state) => state._beanstalk.barn);
  const pctDebtRepaid = fertilized.div(fertilized.plus(unfertilized));
  const unripeTokens = useSelector<AppState, AppState['_bean']['unripe']>((_state) => _state._bean.unripe);
  const urBean = useChainConstant(UNRIPE_BEAN);

  return (
    <Card sx={{ p: 2 }}>
      <Stack gap={1}>
        <Typography variant="h4">Chop Conditions</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={3.7}>
            <Stack gap={0.5}>
              <Tooltip
                title="The claim to future Ripe assets you are forfeiting by Chopping."
                placement="top"
              >
                <Typography variant="body1" color={BeanstalkPalette.theme.winter.error}>
                  Chop Penalty&nbsp;
                  <HelpOutlineIcon
                    sx={{ color: BeanstalkPalette.theme.winter.error, fontSize: FontSize.sm }}
                  />
                </Typography>
              </Tooltip>
              {!unripeTokens[urBean.address] ? (
                <CircularProgress size={16} thickness={5} sx={{ color: BeanstalkPalette.theme.winter.error }} />
              ) : (
                <Typography variant="bodyLarge" fontWeight="400" color={BeanstalkPalette.theme.winter.error}>
                  {displayBN(unripeTokens[urBean.address].chopPenalty)}%
                </Typography>
              )}
            </Stack>
          </Grid>
          <Grid item xs={6} md={3.7}>
            <Stack gap={0.5}>
              <Tooltip title="The percentage of Fertilizer sold out of the total Available Fertilizer." placement="top">
                <Typography variant="body1">
                  Fertilizer Sold&nbsp;
                  <HelpOutlineIcon
                    sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                  />
                </Typography>
              </Tooltip>
              <Typography variant="bodyLarge" fontWeight="400">
                {displayFullBN(recapFundedPct.times(100), 2)}%
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={6} md={4.6}>
            <Stack gap={0.5}>
              <Tooltip title="The percentage of Sprouts that have become Rinsable." placement="top">
                <Typography variant="body1">
                  Debt Repaid to Fertilizer&nbsp;
                  <HelpOutlineIcon
                    sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                  />
                </Typography>
              </Tooltip>
              <Typography variant="bodyLarge" fontWeight="400">
                {pctDebtRepaid.times(100).toFixed(4)}%
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
};

export default ChopConditions;
