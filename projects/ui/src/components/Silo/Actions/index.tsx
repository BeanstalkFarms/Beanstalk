import React, { useMemo } from 'react';
import { Box, Tab } from '@mui/material';
import { ERC20Token, NativeToken } from '@beanstalk/sdk';
import { Pool } from '~/classes';
import { ERC20Token as ERC20TokenOld } from '~/classes/Token';
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
import useSdk from '~/hooks/sdk';

const SLUGS = ['deposit', 'convert', 'transfer', 'withdraw', 'claim'];

const SILO_ACTIONS_MAX_WIDTH = '470px';

const SiloActions : FC<{
  pool: Pool;
  token: ERC20TokenOld;
  siloBalance: FarmerSiloBalance;
}> = (props) => {
  const sdk = useSdk();
  const [tab, handleChange] = useTabs(SLUGS, 'action');
  const hasClaimable = props.siloBalance?.claimable?.amount.gt(0);

  // temp solution
  const token = useMemo(() => {
    const match = sdk.tokens.findBySymbol(props.token.symbol);
    if (match) return match as ERC20Token | NativeToken;
    return undefined;
  }, [props.token.symbol, sdk.tokens]);

  return (
    <>
      <Module sx={{ maxWidth: { lg: SILO_ACTIONS_MAX_WIDTH } }}>
        <ModuleTabs value={tab} onChange={handleChange}>
          <Tab label="Deposit" />
          <Tab label="Convert" />
          <Tab label="Transfer" />
          <Tab label="Withdraw" />
          <BadgeTab label="Claim" showBadge={hasClaimable} />
        </ModuleTabs>
        <ModuleContent>
          {tab === 0 && token ? (
            <Deposit
              pool={props.pool}
              token={token}
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
