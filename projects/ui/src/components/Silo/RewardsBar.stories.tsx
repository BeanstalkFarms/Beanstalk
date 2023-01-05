import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import BigNumber from 'bignumber.js';
import RewardsBar from './RewardsBar';

export default {
  component: RewardsBar,
  args: {}
} as ComponentMeta<typeof RewardsBar>;

const Template: ComponentStory<typeof RewardsBar> = (args: any) => (
  <RewardsBar
    beans={{
      earned: new BigNumber(100),
    }}
    stalk={{
      total: new BigNumber(100),
      active: new BigNumber(100),
      earned: new BigNumber(100),
      grown: new BigNumber(100),
    }}
    seeds={{
      total: new BigNumber(100),
      active: new BigNumber(100),
      earned: new BigNumber(100),
    }}
  />
);

export const Main = Template.bind({});
