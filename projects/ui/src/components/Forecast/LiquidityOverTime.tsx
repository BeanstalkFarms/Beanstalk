import React from 'react';
import { Box, Card, CardProps, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';
import { ZERO_BN } from '../../constants';
import { SeasonalLiquidityDocument, SeasonalLiquidityQuery } from '~/generated/graphql';
import SeasonPlot from '~/components/Common/Charts/SeasonPlot';
import useSeason from '~/hooks/beanstalk/useSeason';

import { FC } from '~/types';

/// Setup SeasonPlot
const getValue = (season: SeasonalLiquidityQuery['seasons'][number]) => parseFloat(season.totalLiquidityUSD);
const formatValue = (value: number) => (
  <Typography variant="h2" color="text.primary">
    ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
  </Typography>
);
const StatProps = {
  title: 'Liquidity',
  gap: 0.25,
  color: 'primary',
  sx: { ml: 0 },
};
const queryConfig = { 
  variables: { season_gt: 6073 },
  context: { subgraph: 'bean' }
};

const LiquidityOverTime: FC<{} & CardProps> = ({ sx }) => {
  const beanPools = useSelector<AppState, AppState['_bean']['pools']>((state) => state._bean.pools);
  const liquidity = Object.values(beanPools).reduce((prev, curr) => prev.plus(curr.liquidity), ZERO_BN);
  const season = useSeason();
  return (
    <Card sx={{ width: '100%', pt: 2, ...sx }}>
      <Box sx={{ position: 'relative' }}>
        <SeasonPlot
          document={SeasonalLiquidityDocument}
          height={250}
          defaultSeason={season?.gt(0) ? season.toNumber() : 0}
          defaultValue={liquidity.toNumber()}
          getValue={getValue}
          formatValue={formatValue}
          StatProps={StatProps}
          queryConfig={queryConfig}
          stackedArea
          dateKey="timestamp"
        />
      </Box>
    </Card>
  );
};

export default LiquidityOverTime;
