import { Grid, Typography } from '@mui/material';
import React from 'react';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { ZERO_BN } from '~/constants';
import { PriceBucket } from '~/hooks/beanstalk/useOrderbook';
import { displayBN } from '~/util';

const OrderBookRow: React.FC<{
  priceKey: string;
  bucket: PriceBucket;
  isMinMax: boolean;
}> = ({ priceKey, bucket, isMinMax }) => (
  <Grid
    container
    item
    direction="row"
    spacing={1}
    px={1.5}
    py={0}
    key={priceKey}
  >
    <Grid item container xs={1.5}>
      <Grid item xs={12}>
        <Typography variant="caption" color="text.primary">
          {priceKey}
        </Typography>
      </Grid>
    </Grid>
    <Grid item container xs={5.25}>
      <Grid item xs={6}>
        <Typography variant="caption" sx={{ color: BeanstalkPalette.theme.winter.orderGreen }}>
          {displayBN(bucket.depth.bean || ZERO_BN)}
        </Typography>
      </Grid>
      <Grid item xs={6} alignItems="flex-end" textAlign="right">
        <Typography variant="caption" sx={{ color: BeanstalkPalette.theme.winter.orderGreen }}>
          {displayBN(
            isMinMax ? bucket.placeInLine.buy.max : bucket.placeInLine.buy.avg
          )}
        </Typography>
      </Grid>
    </Grid>
    <Grid item container xs={5.25}>
      <Grid item xs={6}>
        <Typography variant="caption" sx={{ color: BeanstalkPalette.theme.winter.listingRed }}>
          {displayBN(
            isMinMax ? bucket.placeInLine.sell.min : bucket.placeInLine.sell.avg
          )}
        </Typography>
      </Grid>
      <Grid item xs={6} alignItems="flex-end" textAlign="right">
        <Typography variant="caption" sx={{ color: BeanstalkPalette.theme.winter.listingRed }}>
          {displayBN(bucket.depth.pods)}
        </Typography>
      </Grid>
    </Grid>
  </Grid>
);

export default OrderBookRow;
