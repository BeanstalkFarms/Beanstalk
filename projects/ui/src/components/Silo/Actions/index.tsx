import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, Box, Button, Tab } from '@mui/material';
import { ERC20Token } from '@beanstalk/sdk';
import { Link } from 'react-router-dom';
import BigNumberJS from 'bignumber.js';
import { Pool } from '~/classes';
import { ERC20Token as ERC20TokenOld } from '~/classes/Token';
import { FarmerSiloTokenBalance } from '~/state/farmer/silo';
import useTabs from '~/hooks/display/useTabs';
import BadgeTab from '~/components/Common/BadgeTab';
import Deposit from './Deposit';
import Withdraw from './Withdraw';
import Transfer from './Transfer';
import Deposits from './Deposits';
import { Module, ModuleTabs, ModuleContent } from '~/components/Common/Module';

import { FC } from '~/types';
import useSdk from '~/hooks/sdk';
import useFarmerSiloBalancesAsync from '~/hooks/farmer/useFarmerSiloBalancesAsync';
import Convert from './Convert';
import useMigrationNeeded from '~/hooks/farmer/useMigrationNeeded';
import { useFarmerLegacyWithdrawalsLazyQuery } from '~/generated/graphql';
import useAccount from '~/hooks/ledger/useAccount';
import useCastApolloQuery from '~/hooks/app/useCastApolloQuery';
import LegacyClaim, {
  LegacyWithdrawalSubgraph,
} from '~/components/Silo/Actions/LegacyClaim';
import { transform } from '~/util';

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
  siloBalance: FarmerSiloTokenBalance;
}> = (props) => {
  const sdk = useSdk();
  const [tab, handleChange] = useTabs(SLUGS, 'action');
  const migrationNeeded = useMigrationNeeded();
  const account = useAccount();

  /// Temporary solutions. Remove these when we move the site to use the new sdk types.
  const token = useMemo(() => {
    const match = sdk.tokens.findBySymbol(props.token.symbol) as ERC20Token;
    return match;
  }, [props.token.symbol, sdk.tokens]);

  const siloBalanceAsync = useFarmerSiloBalancesAsync(token);

  const [fetchLegacyWithdrawals, withdrawalsQuery] =
    useFarmerLegacyWithdrawalsLazyQuery({
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    });

  useEffect(() => {
    if (!account || !token.address) return;
    fetchLegacyWithdrawals({
      variables: {
        account: account?.toLowerCase() || '',
        token: token.address,
      },
    });
  }, [account, fetchLegacyWithdrawals, token.address]);

  const withdrawalItems = useCastApolloQuery<LegacyWithdrawalSubgraph>(
    withdrawalsQuery,
    'siloWithdraws',
    useCallback(
      (w) => ({
        season: new BigNumberJS(w.season),
        amount: transform(token.fromBlockchain(w.amount), 'bnjs', token),
      }),
      [token]
    )
  );

  const hasClaimableBeans = withdrawalItems
    ? withdrawalItems.length > 0
    : false;

  return (
    <>
      <Module>
        {migrationNeeded ? (
          <Alert
            sx={{
              borderRadius: 0,
              position: 'relative',
              zIndex: 1,
              backgroundColor: 'primary.light',
              color: 'primary.main',
            }}
            icon={<></>}
          >
            <Link to="/silo?tab=migrate">
              <Button variant="text">
                To use the Silo, migrate your account to Silo V3 &rarr;
              </Button>
            </Link>
          </Alert>
        ) : null}
        <ModuleTabs value={tab} onChange={handleChange}>
          <Tab label="Deposit" disabled={migrationNeeded === true} />
          <Tab label="Convert" disabled={migrationNeeded === true} />
          <Tab label="Transfer" disabled={migrationNeeded === true} />
          <Tab label="Withdraw" disabled={migrationNeeded === true} />
          {hasClaimableBeans && (
            <BadgeTab
              label="Claim"
              showBadge
              disabled={migrationNeeded === true}
            />
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
          {tab === 4 && hasClaimableBeans && withdrawalItems && (
            <LegacyClaim token={token} legacyWithdrawals={withdrawalItems} />
          )}
        </ModuleContent>
      </Module>
      {/* Tables */}
      <Box>
        <Deposits
          token={props.token}
          siloBalance={props.siloBalance}
          useLegacySeason={migrationNeeded}
        />
      </Box>
    </>
  );
};

export default SiloActions;
