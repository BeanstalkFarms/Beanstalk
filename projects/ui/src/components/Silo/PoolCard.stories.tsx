import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import BigNumber from 'bignumber.js';
import { BeanPoolState } from '~/state/bean/pools';
import PoolCard from './PoolCard';

export default {
  component: PoolCard,
  args: {}
} as ComponentMeta<typeof PoolCard>;

const poolState: BeanPoolState = {
  price: new BigNumber(100),
  reserves: [new BigNumber(100), new BigNumber(100)],
  deltaB: new BigNumber(100000),
  liquidity: new BigNumber(123567),
  supply: new BigNumber(1234)
};

const Template: ComponentStory<typeof PoolCard> = (args: any) => (
  <div>Currently broken (unexpected default), will need to investigate</div>
  // <PoolCard
  //   // {...args}
  //   pool={BEAN_ETH_UNIV2_POOL_MAINNET}
  //   poolState={poolState}
  // />
);

export const Main = Template.bind({});
