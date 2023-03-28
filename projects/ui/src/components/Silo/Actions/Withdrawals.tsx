import React, { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useAccount as useWagmiAccount } from 'wagmi';
import { Typography } from '@mui/material';
import { GridColumns } from '@mui/x-data-grid';
import { Token } from '~/classes';
import { FarmerSiloBalance, WithdrawalCrate } from '~/state/farmer/silo';
import { displayFullBN, displayUSD } from '~/util';
import useSeason from '~/hooks/beanstalk/useSeason';
import { ZERO_BN } from '~/constants';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';
import TableCard from '../../Common/TableCard';

import { FC } from '~/types';

type RowData = WithdrawalCrate & { id: BigNumber };

const Withdrawals : FC<{
  token: Token;
  siloBalance: FarmerSiloBalance | undefined;
}> = ({
  token,
  siloBalance,
}) => {
  const getUSD = useSiloTokenToFiat();
  const currentSeason = useSeason();
  const account = useWagmiAccount();

  const rows : RowData[] = useMemo(() => {
    const data : RowData[] = [];
    if (siloBalance) {
      if (siloBalance.claimable.amount.gt(0)) {
        data.push({
          id: currentSeason,
          amount: siloBalance.claimable.amount,
          season: currentSeason,
        });
      }
      if (siloBalance.withdrawn?.crates?.length > 0) {
        data.push(
          ...(siloBalance.withdrawn.crates.map((crate) => ({
            id: crate.season,
            ...crate
          })))
        );
      }
    }
    return data;
  }, [
    siloBalance,
    currentSeason,
  ]);

  const columns = useMemo(() => ([
    {
      field: 'season',
      flex: 2,
      headerName: 'Seasons to Arrival',
      align: 'left',
      headerAlign: 'left',
      valueParser: (value: BigNumber) => value.toNumber(),
      renderCell: (params) => {
        const seasonsToArrival = params.value.minus(currentSeason);
        return seasonsToArrival.lte(0) ? (
          <Typography color="primary">Claimable</Typography>
        ) : (
          <Typography>{seasonsToArrival.toFixed()}</Typography>
        );
      },
      sortable: false,
    },
    {
      field: 'amount',
      flex: 2,
      headerName: 'Withdrawn Amount',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography>
          {displayFullBN(params.value, token.displayDecimals, token.displayDecimals)} 
          <Typography display={{ xs: 'none', md: 'inline' }} color="text.secondary">
            {' '}(~{displayUSD(getUSD(token, params.row.amount))})
          </Typography>
        </Typography>
      ),
      sortable: false,
    },
  ] as GridColumns), [
    token,
    getUSD,
    currentSeason
  ]);

  const amount = siloBalance?.withdrawn.amount;
  const state = !account ? 'disconnected' : !currentSeason ? 'loading' : 'ready';

  return (
    <TableCard
      title={`${token.name} Withdrawals`}
      rows={rows}
      columns={columns}
      amount={amount}
      value={getUSD(token, amount || ZERO_BN)}
      state={state}
      sort={{ field: 'season', sort: 'asc' }}
      token={token}
    />
  );
};

export default Withdrawals;
