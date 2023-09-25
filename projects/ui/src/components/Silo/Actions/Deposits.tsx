import React, { useMemo } from 'react';
import { useAccount as useWagmiAccount } from 'wagmi';
import { Stack, Tooltip, Typography } from '@mui/material';
import { GridColumns } from '@mui/x-data-grid';
import { Token } from '~/classes';
import { FarmerSiloTokenBalance } from '~/state/farmer/silo';
import type { LegacyDepositCrate } from '~/state/farmer/silo';
import { displayBN, displayFullBN } from '~/util';
import { STALK } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';
import COLUMNS from '~/components/Common/Table/cells';
import Fiat from '~/components/Common/Fiat';
import TableCard, { TableCardProps } from '../../Common/TableCard';
import StatHorizontal from '~/components/Common/StatHorizontal';
import { FC } from '~/types';

const Deposits: FC<
  {
    token: Token;
    siloBalance: FarmerSiloTokenBalance | undefined;
    useLegacySeason?: boolean;
  } & Partial<TableCardProps>
> = ({ token, siloBalance, useLegacySeason, ...props }) => {
  const getUSD = useSiloTokenToFiat();
  const account = useWagmiAccount();

  const rows: (LegacyDepositCrate & { id: string })[] = useMemo(
    () =>
      siloBalance?.deposited.crates.map((deposit) => ({
        id: deposit.stem?.toString(),
        ...deposit,
      })) || [],
    [siloBalance?.deposited.crates]
  );

  const columns = useMemo(
    () =>
      [
        COLUMNS.depositId(useLegacySeason ? 'Season' : 'Stem'),
        {
          field: 'amount',
          flex: 1,
          headerName: 'Amount',
          align: 'left',
          headerAlign: 'left',
          valueFormatter: (params) =>
            displayFullBN(
              params.value,
              token.displayDecimals,
              token.displayDecimals
            ),
          renderCell: (params) => (
            <Tooltip
              placement="bottom"
              title={
                <Stack gap={0.5}>
                  <StatHorizontal label="BDV when Deposited">
                    {displayFullBN(params.row.bdv.div(params.row.amount), 6)}
                  </StatHorizontal>
                  <StatHorizontal label="Total BDV">
                    {displayFullBN(params.row.bdv, token.displayDecimals)}
                  </StatHorizontal>
                  <StatHorizontal label="Current Value">
                    <Fiat amount={params.row.amount} token={token} />
                  </StatHorizontal>
                </Stack>
              }
            >
              <span>
                <Typography display={{ xs: 'none', md: 'block' }}>
                  {displayFullBN(
                    params.value,
                    token.displayDecimals,
                    token.displayDecimals
                  )}
                </Typography>
                <Typography display={{ xs: 'block', md: 'none' }}>
                  {displayBN(params.value)}
                </Typography>
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
          valueFormatter: (params) => displayBN(params.value.total),
          renderCell: (params) => (
            <Tooltip
              placement="bottom"
              title={
                <Stack gap={0.5}>
                  <StatHorizontal label="Stalk at Deposit">
                    {displayFullBN(params.row.stalk.base, 2, 2)}
                  </StatHorizontal>
                  <StatHorizontal label="Stalk grown since Deposit">
                    {displayFullBN(params.row.stalk.grown, 2, 2)}
                  </StatHorizontal>
                </Stack>
              }
            >
              <span>
                <Typography display={{ xs: 'none', md: 'block' }}>
                  {displayFullBN(
                    params.row.stalk.total,
                    STALK.displayDecimals,
                    STALK.displayDecimals
                  )}
                </Typography>
                <Typography display={{ xs: 'block', md: 'none' }}>
                  {displayBN(params.row.stalk.total)}
                </Typography>
              </span>
            </Tooltip>
          ),
          sortable: false,
        },
        COLUMNS.seeds,
      ] as GridColumns,
    [useLegacySeason, token]
  );

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
      {...props}
    />
  );
};

export default Deposits;
