import React, { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useAccount as useWagmiAccount } from 'wagmi';
import { Stack, Tooltip, Typography } from '@mui/material';
import { GridColumns } from '@mui/x-data-grid';
import { Token } from '~/classes';
import { FarmerSiloBalance } from '~/state/farmer/silo';
import type { DepositCrate } from '~/state/farmer/silo';
import { calculateGrownStalk, displayBN, displayFullBN } from '~/util';
import useSeason from '~/hooks/beanstalk/useSeason';
import { BEAN, STALK } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';
import useChainConstant from '~/hooks/chain/useChainConstant';
import COLUMNS from '~/components/Common/Table/cells';
import Fiat from '~/components/Common/Fiat';
import TableCard from '../../Common/TableCard';
import StatHorizontal from '~/components/Common/StatHorizontal';

/**
 * Prep data to loading to a CratesCard.
 */
import { FC } from '~/types';

const Deposits : FC<{
  token: Token;
  siloBalance: FarmerSiloBalance | undefined;
}> = ({
  token,
  siloBalance,
}) => {
  const Bean = useChainConstant(BEAN);
  const getUSD = useSiloTokenToFiat();
  const currentSeason = useSeason();
  const account = useWagmiAccount();

  const rows : (DepositCrate & { id: BigNumber })[] = useMemo(() => 
    siloBalance?.deposited.crates.map((deposit) => ({
      id: deposit.season,
      ...deposit
    })) || [],
    [siloBalance?.deposited.crates]
  );

  const columns = useMemo(() => ([
    COLUMNS.season,
    {
      field: 'amount',
      flex: 1,
      headerName: 'Amount',
      align: 'left',
      headerAlign: 'left',
      valueFormatter: (params) => displayFullBN(params.value, token.displayDecimals, token.displayDecimals),
      renderCell: (params) => (
        <Tooltip
          placement="bottom"
          title={(
            <Stack gap={0.5}>
              <StatHorizontal label="BDV when Deposited">
                {displayFullBN(params.row.bdv.div(params.row.amount), 6)}
              </StatHorizontal>
              <StatHorizontal label="Total BDV">
                {displayFullBN(params.row.bdv, token.displayDecimals)}
              </StatHorizontal>
              <StatHorizontal label="Current Value">
                <Fiat amount={params.row.amount} token={Bean} />
              </StatHorizontal>
            </Stack>
          )}
        >
          <span>
            <Typography display={{ xs: 'none', md: 'block' }}>{displayFullBN(params.value, token.displayDecimals, token.displayDecimals)}</Typography>
            <Typography display={{ xs: 'block', md: 'none' }}>{displayBN(params.value)}</Typography>
          </span>
        </Tooltip>
      ),
      sortable: false,
    },
    {
      field: 'stalk',
      flex: 1,
      headerName: 'Stalk',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params) => displayBN(params.value),
      renderCell: (params) => {
        const grownStalk = calculateGrownStalk(currentSeason, params.row.seeds, params.row.season); 
        const totalStalk = params.value.plus(grownStalk);
        return (
          <Tooltip
            placement="bottom"
            title={(
              <Stack gap={0.5}>
                <StatHorizontal label="Stalk at Deposit">
                  {displayFullBN(params.row.stalk, 2, 2)}
                </StatHorizontal>
                <StatHorizontal label="Stalk grown since Deposit">
                  {displayFullBN(grownStalk, 2, 2)}
                </StatHorizontal>
                {/* <Typography color="gray">Earning {displayBN(seedsPerSeason)} Stalk per Season</Typography> */}
              </Stack>
            )}
          >
            <span>
              <Typography display={{ xs: 'none', md: 'block' }}>{displayFullBN(totalStalk, STALK.displayDecimals, STALK.displayDecimals)}</Typography>
              <Typography display={{ xs: 'block', md: 'none' }}>{displayBN(totalStalk)}</Typography>
            </span>
          </Tooltip>
        );
      },
      sortable: false,
    },
    COLUMNS.seeds,
  ] as GridColumns), [token.displayDecimals, Bean, currentSeason]);

  const amount = siloBalance?.deposited.amount;
  const state = !account ? 'disconnected' : 'ready';

  return (
    <TableCard
      title={`${token.name} Deposits`}
      rows={rows}
      columns={columns}
      amount={amount}
      value={getUSD(token, amount || ZERO_BN)}
      state={state}
      token={token}
    />
  );
};

export default Deposits;
