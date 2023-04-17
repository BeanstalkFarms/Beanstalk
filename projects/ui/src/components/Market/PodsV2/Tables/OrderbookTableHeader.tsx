import { Grid, Typography } from '@mui/material';
import React from 'react';

const OrderbookTableHeader: React.FC<{ isMinMax: boolean }> = (
  isMinMax
) => (
  <Grid container direction="row" spacing={1} px={1.5}>
    <Grid item container xs={1.5}>
      <Grid item xs={12} alignItems="flex-start" textAlign="left">
        <Typography variant="caption" color="text.secondary">
          PRICE
        </Typography>
      </Grid>
    </Grid>
    <Grid item container xs={5.25}>
      <Grid item xs={6} alignItems="flex-start" textAlign="left">
        <Typography variant="caption" color="text.secondary">
          DEPTH(BEAN)
        </Typography>
      </Grid>
      <Grid item xs={6} alignItems="flex-end" textAlign="right">
        <Typography variant="caption" color="text.secondary">
          {isMinMax ? 'MAX' : 'AVG'} PLACE IN LINE (BUY)
        </Typography>
      </Grid>
    </Grid>
    <Grid item container xs={5.25}>
      <Grid item xs={6} alignItems="flex-start">
        <Typography variant="caption" color="text.secondary">
          {isMinMax ? 'MIN' : 'AVG'} PLACE IN LINE (SELL)
        </Typography>
      </Grid>
      <Grid item xs={6} alignItems="flex-end" textAlign="right">
        <Typography variant="caption" color="text.secondary">
          DEPTH(PODS)
        </Typography>
      </Grid>
    </Grid>
  </Grid>
  );

export default OrderbookTableHeader;
