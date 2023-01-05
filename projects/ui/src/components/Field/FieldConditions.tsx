import React from 'react';
import { Card, Grid, Stack, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { displayBN } from '../../util';
import { AppState } from '../../state';
import { FontSize } from '../App/muiTheme';

import { FC } from '~/types';

export interface FieldConditionsProps {
  beanstalkField: AppState['_beanstalk']['field'];
  // farmerField: AppState['_farmer']['field'];
  // podLine: BigNumber;
}

const FieldConditions: FC<FieldConditionsProps> = ({
 beanstalkField,
 // farmerField,
 // podLine,
}) => (
  <Card sx={{ p: 2 }}>
    <Stack gap={1}>
      <Typography variant="h4">Field Conditions</Typography>
      <Grid container spacing={1}>
        <Grid item xs={6} md={3}>
          <Stack gap={0.5}>
            <Tooltip
              title="The number of Beans that can currently be Sown (lent to Beanstalk)."
              placement="top"
            >
              <Typography variant="body1">
                Available Soil&nbsp;
                <HelpOutlineIcon
                  sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                />
              </Typography>
            </Tooltip>
            <Typography variant="bodyLarge" fontWeight="400">
              {displayBN(beanstalkField.soil)}
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} md={3}>
          <Stack gap={0.5}>
            <Tooltip title="The interest rate for Sowing Beans." placement="top">
              <Typography variant="body1">
                Temperature&nbsp;
                <HelpOutlineIcon
                  sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                />
              </Typography>
            </Tooltip>
            <Typography variant="bodyLarge" fontWeight="400">
              {displayBN(beanstalkField.weather.yield)}%
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} md={3}>
          <Stack gap={0.5}>
            <Tooltip title="The number of Pods that will become Harvestable before Pods earned for newly Sown Beans, based on the FIFO Harvest schedule." placement="top">
              <Typography variant="body1">
                Pod Line&nbsp;
                <HelpOutlineIcon
                  sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                />
              </Typography>
            </Tooltip>
            <Typography variant="bodyLarge" fontWeight="400">
              {displayBN(beanstalkField.podLine)}
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} md={3}>
          <Stack gap={0.5}>
            <Tooltip title="The number of Pods that have become redeemable for a Bean (i.e., the debt paid back by Beanstalk to date)." placement="top">
              <Typography variant="body1">
                Pods Harvested&nbsp;
                <HelpOutlineIcon
                  sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                />
              </Typography>
            </Tooltip>
            <Typography variant="bodyLarge">
              {displayBN(beanstalkField.harvestableIndex)}
            </Typography>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  </Card>
);

export default FieldConditions;
