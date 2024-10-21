import React from 'react';
import { Tab } from '@mui/material';
import { ERC20Token } from '@beanstalk/sdk';

import useTabs from '~/hooks/display/useTabs';
import { Module, ModuleContent, ModuleTabs } from '~/components/Common/Module';

import { FC } from '~/types';
import Convert from './Convert';
import Withdraw from './Withdraw';
import Deposit from './Deposit';

/**
 * Show the three primary Silo actions: Deposit, Convert, Withdraw.
 * Card containing the Deposit / Convert / Withdraw, broken up by tabs.
 * Each tab contains a single form.
 */

const SLUGS = ['deposit', 'convert', 'withdraw', 'claim'];

const SiloActions: FC<{
  token: ERC20Token;
}> = (props) => {
  const [tab, handleChange] = useTabs(SLUGS, 'action', 0);

  return (
    <>
      <Module>
        <ModuleTabs value={tab} onChange={handleChange}>
          <Tab label="Deposit" value={0} />
          <Tab label="Convert" value={1} />
          <Tab label="Withdraw" value={2} />
        </ModuleTabs>
        <ModuleContent>
          {tab === 0 && <Deposit token={props.token} />}
          {tab === 1 && <Convert fromToken={props.token} />}
          {tab === 2 && <Withdraw token={props.token} />}
        </ModuleContent>
      </Module>
    </>
  );
};

export default SiloActions;
