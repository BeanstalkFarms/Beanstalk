import { Card, Tab, Tabs } from '@mui/material';

import Crosses from '~/components/Analytics/Bean/Crosses';
import DeltaB from '~/components/Analytics/Bean/DeltaB';
import { FC } from '~/types';
import Liquidity from '~/components/Analytics/Bean/Liquidity';
import MarketCap from '~/components/Analytics/Bean/MarketCap';
import Price from './Price';
import React from 'react';
import Supply from '~/components/Analytics/Bean/Supply';
import VolumeChart from '~/components/Analytics/Bean/VolumeChart';
import useTabs from '~/hooks/display/useTabs';

const SLUGS = [
  'price',
  'volume',
  'liquidity',
  'mktcap',
  'supply',
  'crosses',
  'delta_b',
];

const BeanAnalytics: FC<{}> = () => {
  const [tab, handleChangeTab] = useTabs(SLUGS, 'bean');
  const CHART_HEIGHT = 300;
  return (
    <Card>
      <Tabs
        value={tab}
        onChange={handleChangeTab}
        sx={{ px: 2, pt: 2, pb: 1.5 }}
      >
        <Tab label="Bean Price" />
        <Tab label="Volume" />
        <Tab label="Liquidity" />
        <Tab label="Market Cap" />
        <Tab label="Supply" />
        <Tab label="Crosses" />
        <Tab label="Delta B" />
      </Tabs>
      {/* 
        TODO: The height prop currently *only* reflects in the chart height. However, the full component
          has other components that yield a larger height. All the components below should be refactored
          to account for their additional parts, so when a height is put in then you would get that 
          exact height. Alternatively, the existing height prop should be renamed to chartHeight.
      */}
      {tab === 0 && <Price height={CHART_HEIGHT} />}
      {tab === 1 && <VolumeChart height={375} />}
      {tab === 2 && <Liquidity height={CHART_HEIGHT} />}
      {tab === 3 && <MarketCap height={CHART_HEIGHT} />}
      {tab === 4 && <Supply height={CHART_HEIGHT} />}
      {tab === 5 && <Crosses height={CHART_HEIGHT} />}
      {tab === 6 && <DeltaB height={CHART_HEIGHT} />}
    </Card>
  );
};

export default BeanAnalytics;
