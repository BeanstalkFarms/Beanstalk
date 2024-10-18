import React, { useMemo } from 'react';
import { useAccount as useWagmiAccount } from 'wagmi';
import { Stack, Tooltip, Typography } from '@mui/material';
import { GridColumns } from '@mui/x-data-grid';
import { ERC20Token } from '@beanstalk/sdk';
import { BigNumber as ethersBN } from 'ethers';
import { BigNumber } from 'bignumber.js';
import { Token } from '~/classes';
import { FarmerSiloTokenBalance } from '~/state/farmer/silo';
import type { LegacyDepositCrate } from '~/state/farmer/silo';
import { displayBN, displayFullBN, transform } from '~/util';
import { STALK } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';
import COLUMNS from '~/components/Common/Table/cells';
import Fiat from '~/components/Common/Fiat';
import StatHorizontal from '~/components/Common/StatHorizontal';
import { FC } from '~/types';
import useStemTipForToken from '~/hooks/beanstalk/useStemTipForToken';
import useSdk from '~/hooks/sdk';
import useBDV from '~/hooks/beanstalk/useBDV';
import TableCard, { TableCardProps } from '../../Common/TableCard';

const Deposits: FC<
  {
    token: Token;
    siloBalance: FarmerSiloTokenBalance | undefined;
    useLegacySeason?: boolean;
  } & Partial<TableCardProps>
> = ({ token, siloBalance, useLegacySeason, ...props }) => {
  const sdk = useSdk();
  const getUSD = useSiloTokenToFiat();
  const getBDV = useBDV();
  const account = useWagmiAccount();
  const newToken = sdk.tokens.findBySymbol(token.symbol) as ERC20Token;

  const stemTip = useStemTipForToken(newToken) || ethersBN.from(0);
  const lastStem = siloBalance?.mowStatus?.lastStem || ethersBN.from(0);
  const deltaStem = transform(stemTip.sub(lastStem), 'bnjs').div(1_000_000);
  const rows: (LegacyDepositCrate & { key: string })[] = useMemo(
    () =>
      siloBalance?.deposited.crates.map((deposit) => ({
        key: deposit.id.toString(),
        mowableStalk: deposit.bdv?.multipliedBy(deltaStem).div(10000),
        ...deposit,
      })) || [],
    [siloBalance?.deposited.crates, deltaStem]
  );

  const hasGerminating = !!rows.find((r) => r.isGerminating);

  const columns = useMemo(
    () =>
      [
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
                  <StatHorizontal label="Recorded BDV">
                    {displayFullBN(params.row.bdv, token.displayDecimals)}
                  </StatHorizontal>
                  <StatHorizontal label="Current BDV">
                    {displayFullBN(
                      params.row.amount.multipliedBy(getBDV(token)),
                      token.displayDecimals
                    )}
                  </StatHorizontal>
                  <StatHorizontal label="Current Value">
                    <Fiat amount={params.row.amount} token={token} />
                  </StatHorizontal>
                  <StatHorizontal label="Stem">
                    {params.row.key.toString()}
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
          headerName: 'Total Stalk',
          align: 'left',
          headerAlign: 'left',
          valueFormatter: (params) => displayBN(params.value.total),
          renderCell: (params) => (
            <Tooltip
              placement="bottom"
              title={
                <Stack gap={0.5}>
                  <StatHorizontal label="Stalk at Deposit">
                    {displayFullBN(params.row.stalk.base, 2, 2)}
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
        {
          field: 'stalk.grown',
          flex: 1,
          headerName: 'Grown Stalk',
          align: 'right',
          headerAlign: 'right',
          valueFormatter: (params) => displayBN(params.value),
          renderCell: (params) => (
            <Tooltip
              placement="bottom"
              title={
                <Stack gap={0.5}>
                  <StatHorizontal label="Mown Grown Stalk">
                    {displayFullBN(
                      BigNumber.max(
                        params.row.stalk.grown.minus(params.row.mowableStalk),
                        ZERO_BN
                      ),
                      2,
                      2
                    )}
                  </StatHorizontal>
                  <StatHorizontal label="Mowable Grown Stalk">
                    {displayFullBN(params.row.mowableStalk, 2, 2)}
                  </StatHorizontal>
                </Stack>
              }
            >
              <span>
                <Typography display={{ xs: 'none', md: 'block' }}>
                  {displayFullBN(params.row.stalk.grown, 2, 2)}
                </Typography>
                <Typography display={{ xs: 'block', md: 'none' }}>
                  {displayFullBN(params.row.stalk.grown, 2, 2)}
                </Typography>
              </span>
            </Tooltip>
          ),
          sortable: false,
        },
        COLUMNS.seeds,
      ] as GridColumns,
    [token, getBDV]
  );

  const amount = siloBalance?.deposited.amount;
  const state = !account ? 'disconnected' : 'ready';

  return (
    <>
      <TableCard
        title={`${token.name} Deposits`}
        rows={rows}
        columns={columns}
        amount={amount}
        value={getUSD(token, amount || ZERO_BN)}
        state={state}
        token={token}
        footNote={
          hasGerminating
            ? 'Green rows represent Germinating Deposits'
            : undefined
        }
        {...props}
      />
    </>
  );
};

export default Deposits;
