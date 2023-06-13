import React, { useMemo } from 'react';
import { Box, Tab } from '@mui/material';
import { ERC20Token } from '@beanstalk/sdk';
import { Pool } from '~/classes';
import { ERC20Token as ERC20TokenOld } from '~/classes/Token';
import { FarmerSiloBalance } from '~/state/farmer/silo';
import useTabs from '~/hooks/display/useTabs';
import BadgeTab from '~/components/Common/BadgeTab';
import Deposit from './Deposit';
import Withdraw from './Withdraw';
import Transfer from './Transfer';
import Claim from './Claim';
import Deposits from './Deposits';
import Withdrawals from './Withdrawals';
import { Module, ModuleTabs, ModuleContent } from '~/components/Common/Module';

import { FC } from '~/types';
import useSdk from '~/hooks/sdk';
import useFarmerSiloBalancesAsync from '~/hooks/farmer/useFarmerSiloBalancesAsync';
import Convert from './Convert';

/**
 * Show the three primary Silo actions: Deposit, Withdraw, Claim.
 * Displays two components:
 * (1) a Card containing the Deposit / Withdraw / Claim forms, broken
 *     up by tabs. Each tab contains a single form.
 * (2) a table of Deposits and Withdrawals, shown dependent on the
 *     selected tab. The Withdrawals table also displays an aggregated
 *     "claimable" row and is shown for the Claim tab only (updated for Silo V3)
 */

const SLUGS = ['deposit', 'convert', 'transfer', 'withdraw', 'claim'];

const SiloActions: FC<{
  pool: Pool;
  token: ERC20TokenOld;
  siloBalance: FarmerSiloBalance;
}> = (props) => {
  const sdk = useSdk();
  const [tab, handleChange] = useTabs(SLUGS, 'action');
  const hasClaimable = props.siloBalance?.claimable?.amount.gt(0);

  /// Temporary solutions. Remove these when we move the site to use the new sdk types.
  const token = useMemo(() => {
    const match = sdk.tokens.findBySymbol(props.token.symbol) as ERC20Token;
    return match;
  }, [props.token.symbol, sdk.tokens]);

  const siloBalanceAsync = useFarmerSiloBalancesAsync(token);

  if (!token) {
    return null;
  }

  /// TODO: TEMPORARY. FIX ME
  const hasClaimableBeans = true;

  return (
    <>
      <Module>
        <ModuleTabs value={tab} onChange={handleChange}>
          <Tab label="Deposit" />
          <Tab label="Convert" />
          <Tab label="Transfer" />
          <Tab label="Withdraw" />
          {hasClaimableBeans && (
            <BadgeTab label="Claim" showBadge={hasClaimable} />
          )}
        </ModuleTabs>
        <ModuleContent>
          {tab === 0 && <Deposit token={token} />}
          {tab === 1 && <Convert fromToken={token} />}
          {tab === 2 && (
            <Transfer token={token} siloBalance={siloBalanceAsync} />
          )}
          {tab === 3 && (
            <Withdraw token={token} siloBalance={siloBalanceAsync} />
          )}

          {hasClaimableBeans && tab === 4 && (
            <Claim token={token} siloBalance={props.siloBalance} />
          )}
        </ModuleContent>
      </Module>
      {/* Tables */}
      <Box sx={{ display: tab <= 3 ? 'block' : 'none' }}>
        <Deposits token={props.token} siloBalance={props.siloBalance} />
      </Box>
      <Box sx={{ display: tab >= 4 ? 'block' : 'none' }}>
        <Withdrawals token={props.token} siloBalance={props.siloBalance} />
      </Box>
    </>
  );
};

export default SiloActions;
