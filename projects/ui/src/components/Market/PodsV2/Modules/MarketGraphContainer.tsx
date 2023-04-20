import { Box, CircularProgress } from '@mui/material';
import { useAtomValue } from 'jotai';

import React from 'react';
import CondensedCard from '~/components/Common/Card/CondensedCard';

import Centered from '~/components/Common/ZeroState/Centered';
import useMarketData from '~/hooks/beanstalk/useMarketData';
import { marketBottomTabsAtom } from '../info/atom-context';
import EntityGraph from './MarketGraph';

const MarketGraphContainer: React.FC<{ 
  chartHeight: string; 
}> = ({
  chartHeight,
}) => {
  const data = useMarketData();
  const openState = useAtomValue(marketBottomTabsAtom);
  const marketBottomTabsOpen = openState === 1 || openState === 2;

  return (
    <CondensedCard title="OVERVIEW" sx={{ height: '100%' }}>
      {!data.loading && data.listings && data.orders ? (
        <Box 
          width="100%" 
          sx={{ height: chartHeight, minHeight: marketBottomTabsOpen ? '140px' : 0 }}
        >
          <EntityGraph
            listings={data.listings}
            orders={data.orders}
            maxPlaceInLine={data.maxPlaceInLine}
            maxPlotSize={data.maxPlotSize}
            harvestableIndex={data.harvestableIndex}
          />
        </Box>
      ) : (
        <Box sx={{ height: chartHeight, overflow: 'hidden' }}>
          <Centered height="100%">
            <CircularProgress variant="indeterminate" />
          </Centered>
        </Box>
      )}
    </CondensedCard>
  );
};

export default MarketGraphContainer;
