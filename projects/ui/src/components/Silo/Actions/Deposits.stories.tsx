import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import BigNumber from 'bignumber.js';
import Deposits from './Deposits';
import { DepositCrate, FarmerSiloBalance, WithdrawalCrate } from '../../../state/farmer/silo';
import { BEAN_ETH_UNIV2_LP } from '../../../constants/tokens';
import { SupportedChainId } from '../../../constants/chains';

export default {
  component: Deposits,
  args: {}
} as ComponentMeta<typeof Deposits>;

const deposit: DepositCrate = {
  season: new BigNumber(100),
  amount: new BigNumber(100),
  bdv: new BigNumber(100),
  stalk: new BigNumber(100),
  seeds: new BigNumber(100),
};

const deposit2: DepositCrate = {
  season: new BigNumber(345),
  amount: new BigNumber(345),
  bdv: new BigNumber(345),
  stalk: new BigNumber(345),
  seeds: new BigNumber(345),
};

const withdrawal: WithdrawalCrate = {
  season: new BigNumber(698),
  amount: new BigNumber(760)
};

const withdrawal2: WithdrawalCrate = {
  season: new BigNumber(345),
  amount: new BigNumber(753460)
};

const siloBalance: FarmerSiloBalance = {
  circulating: new BigNumber(100), // The circulating balance in the Farmer's wallet.
  wrapped: new BigNumber(100), // The Farmer's wrapped balance.
  deposited: {
    amount: new BigNumber(100),
    bdv: new BigNumber(100),
    crates: [
      {
        amount: new BigNumber(100),
        bdv: new BigNumber(100),
        season: new BigNumber(6074),
        stalk: new BigNumber(100),
        seeds: new BigNumber(200),
      }
    ]
  },
  withdrawn: {
    amount: new BigNumber(100),
    bdv: new BigNumber(100),
    crates: [
      {
        amount: new BigNumber(100),
        season: new BigNumber(6074),
      }
    ]
  },
  claimable: {
    amount: new BigNumber(100),
    crates: [
      {
        amount: new BigNumber(100),
        season: new BigNumber(6074),
      }
    ]
  },
};

const Template: ComponentStory<typeof Deposits> = (args: any) => (
  <Deposits token={BEAN_ETH_UNIV2_LP[SupportedChainId.MAINNET]} siloBalance={siloBalance} />
);

export const Main = Template.bind({});
