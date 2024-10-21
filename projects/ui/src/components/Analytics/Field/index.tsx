import React from 'react';

import { Card, Tabs, Tab } from '@mui/material';
import useTabs from '~/hooks/display/useTabs';
import { FC } from '~/types';
import HarvestedPods from './HarvestedPods';
import PodRate from './PodRate';
import Pods from './Pods';
import Temperature from './Temperature';
import Sown from './Sown';
import RRoR from './RRoR';

const SLUGS = [
  'rror',
  'temperature',
  'pods',
  'podrate',
  'sown',
  'harvested',
  'sowers',
];

const FieldAnalytics: FC<{}> = () => {
  const [tab, handleChangeTab] = useTabs(SLUGS, 'field');
  return (
    <Card>
      <Tabs
        value={tab}
        onChange={handleChangeTab}
        sx={{ px: 2, pt: 2, pb: 1.5 }}
      >
        <Tab label="RRoR" />
        <Tab label="Max Temperature" />
        <Tab label="Pods" />
        <Tab label="Pod Rate" />
        <Tab label="Sown" />
        <Tab label="Harvested" />
        <Tab label="Total Sowers" />
      </Tabs>
      {tab === 0 && <RRoR height={300} />}
      {tab === 1 && <Temperature height={300} />}
      {tab === 2 && <Pods height={300} />}
      {tab === 3 && <PodRate height={300} />}
      {tab === 4 && <Sown height={300} />}
      {tab === 5 && <HarvestedPods height={300} />}

    </Card>
  );
};

export default FieldAnalytics;
