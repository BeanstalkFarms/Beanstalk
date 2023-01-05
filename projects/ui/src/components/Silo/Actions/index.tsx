import React from 'react';
import { Box, Tab } from '@mui/material';
import { Pool } from '~/classes';
import { ERC20Token } from '~/classes/Token';
import { FarmerSiloBalance } from '~/state/farmer/silo';
import useTabs from '~/hooks/display/useTabs';
import BadgeTab from '~/components/Common/BadgeTab';
import Deposit from './Deposit';
import Withdraw from './Withdraw';
import Claim from './Claim';
import Deposits from './Deposits';
import Withdrawals from './Withdrawals';
import Transfer from './Transfer';
import Convert from './Convert';
import { Module, ModuleTabs, ModuleContent } from '~/components/Common/Module';

/**
 * Show the three primary Silo actions: Deposit, Withdraw, Claim.
 * Displays two components:
 * (1) a Card containing the Deposit / Withdraw / Claim forms, broken
 *     up by tabs. Each tab contains a single form.
 * (2) a table of Deposits and Withdrawals, shown dependent on the
 *     selected tab. The Withdrawals table also displays an aggregated
 *     "claimable" row and is shown for both Withdraw & Claim tabs.
 */
import { FC } from '~/types';

const SLUGS = ['deposit', 'convert', 'transfer', 'withdraw', 'claim'];

const SiloActions : FC<{
  pool: Pool;
  token: ERC20Token;
  siloBalance: FarmerSiloBalance;
}> = (props) => {
  const [tab, handleChange] = useTabs(SLUGS, 'action');
  const hasClaimable = props.siloBalance?.claimable?.amount.gt(0);
  return (
    <>
      <Module>
        <ModuleTabs value={tab} onChange={handleChange}>
          <Tab label="Deposit" />
          <Tab label="Convert" />
          <Tab label="Transfer" />
          <Tab label="Withdraw" />
          <BadgeTab label="Claim" showBadge={hasClaimable} />
        </ModuleTabs>
        <ModuleContent>
          {tab === 0 ? (
            <Deposit
              pool={props.pool}
              token={props.token}
            />
          ) : null}
          {tab === 1 ? (
            <Convert
              pool={props.pool}
              fromToken={props.token}
            />
          ) : null}
          {tab === 2 ? (
            <Transfer
              token={props.token}
            />
          ) : null}
          {tab === 3 ? (
            <Withdraw
              token={props.token}
            />
          ) : null}
          {tab === 4 ? (
            <Claim
              token={props.token}
              siloBalance={props.siloBalance}
            />
          ) : null}
        </ModuleContent>
      </Module>
      {/* Tables */}
      <Box sx={{ display: tab <= 2 ? 'block' : 'none' }}>
        <Deposits
          token={props.token}
          siloBalance={props.siloBalance}
        />
      </Box>
      <Box sx={{ display: tab >= 3 ? 'block' : 'none' }}>
        <Withdrawals
          token={props.token}
          siloBalance={props.siloBalance}
        />
      </Box>
    </>
  );
};

export default SiloActions;
