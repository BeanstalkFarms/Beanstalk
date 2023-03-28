import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import BigNumber from 'bignumber.js';
import { initialFarmerSilo } from '~/state/farmer/silo/reducer';
import { initialBeanstalkSilo } from '~/state/beanstalk/silo/reducer';

import Overview from './Overview';

export default {
  component: Overview,
} as ComponentMeta<typeof Overview>;

const n = new BigNumber(60_740);
const s = {
  value: n,
  byToken: {}
};

const Template: ComponentStory<typeof Overview> = (args: any) => (
  <Overview
    farmerSilo={initialFarmerSilo}
    beanstalkSilo={initialBeanstalkSilo}
    breakdown={{
      totalValue: n,
      states: {
        circulating: s,
        farm:      s,
        claimable: s,
        deposited: s,
        withdrawn: s,
      }
    }}
    season={new BigNumber(6074)}
  />
);

export const Main = Template.bind({});
