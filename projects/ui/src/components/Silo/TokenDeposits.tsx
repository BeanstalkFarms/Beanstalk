/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useMemo, useState } from 'react';
import { ERC20Token, Token } from '@beanstalk/sdk-core';
import BigNumberJS from 'bignumber.js';
import { BigNumber } from 'ethers';
import useStemTipForToken from '~/hooks/beanstalk/useStemTipForToken';
import useSdk from '~/hooks/sdk';
import {
  FarmerSiloTokenBalance,
  LegacyDepositCrate,
} from '~/state/farmer/silo';
import { useAccount } from 'wagmi';
import { transform, trimAddress } from '~/util';
import { GridColumns } from '@mui/x-data-grid';
import { Button, Dialog, Stack, Typography } from '@mui/material';
import { SEEDS, STALK } from '~/constants/tokens';
import { CheckCircleRounded, CircleOutlined } from '@mui/icons-material';
import TokenIcon from '~/components/Common/TokenIcon';
import Fiat from '~/components/Common/Fiat';
import TableCard from '~/components/Common/TableCard';
import {
  BeanstalkPalette,
  FontSize,
  FontWeight,
  IconSize,
} from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import AddressIcon from '~/components/Common/AddressIcon';

type TokenDepositRow = LegacyDepositCrate & { id: string };

type TokenDepositsSelectType = 'single' | 'multi' | 'view';

const TokenDeposits = ({
  token,
  siloBalance,
  selectType,
}: {
  token: Token;
  siloBalance: FarmerSiloTokenBalance;
  selectType?: TokenDepositsSelectType;
}) => {
  const sdk = useSdk();
  const { address: account } = useAccount();

  const newToken = sdk.tokens.findBySymbol(token.symbol) as ERC20Token;
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const stemTip = useStemTipForToken(newToken) || BigNumber.from(0);
  const lastStem = siloBalance?.mowStatus?.lastStem || BigNumber.from(0);
  const deltaStem = transform(stemTip.sub(lastStem), 'bnjs').div(1_000_000);
  const rows: TokenDepositRow[] = useMemo(
    () =>
      siloBalance?.deposited.crates.map((deposit) => ({
        id: deposit.stem?.toString(),
        mowableStalk: deposit.bdv?.multipliedBy(deltaStem).div(10000),
        ...deposit,
      })) || [],
    [siloBalance?.deposited.crates, deltaStem]
  );

  const selectedDeposits = rows.filter((row) => selected.has(row.id));

  const columns = React.useMemo(() => {
    const cols: GridColumns<TokenDepositRow> = [
      {
        field: 'id',
        flex: 0.75,
        headerName: 'Deposit',
        align: 'left',
        valueGetter: (params) => parseFloat(params.row.id),
        renderCell: (params) => {
          const isMultiSelect = selectType === 'multi';
          const isSelected = selected.has(params.row.id);

          return (
            <Stack direction="row" alignItems="center" gap={0.5}>
              {isMultiSelect ? <CircleSelect isSelected={isSelected} /> : null}
              <Typography>{params.row.id}</Typography>
            </Stack>
          );
        },
        sortable: true,
      },
      {
        field: 'amount',
        flex: 0.9,
        headerName: 'Amount',
        align: 'right',
        headerAlign: 'right',
        valueGetter: (params) => params.row.amount.toNumber(),
        renderCell: (params) => (
          <Stack alignItems="flex-end">
            <Stack direction="row" gap={0.5} alignItems="flex-end">
              <TokenIcon token={token} css={{ marginBottom: '2px' }} />
              <Typography align="right">
                {params.row.amount.toFormat(2, BigNumberJS.ROUND_HALF_CEIL)}
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              <Fiat token={token} amount={params.row.amount} />
            </Typography>
          </Stack>
        ),
        sortable: true,
      },
      {
        field: 'stalk',
        flex: 1.4,
        headerName: 'Stalk',
        align: 'right',
        headerAlign: 'right',
        valueGetter: (params) => params.row.stalk.total.toNumber(),
        renderCell: (params) => (
          <Stack alignItems="flex-end">
            <Typography align="right">
              <TokenIcon token={STALK} />
              {params.row.stalk.total.toFormat(2, BigNumberJS.ROUND_HALF_CEIL)}
            </Typography>
            <Typography align="right" color="text.secondary">
              Grown since Deposit:{' '}
              {params.row.stalk.grown.toFormat(2, BigNumberJS.ROUND_HALF_CEIL)}
            </Typography>
          </Stack>
        ),
        sortable: true,
      },
      {
        field: 'seeds',
        flex: 1,
        headerName: 'Seeds',
        align: 'right',
        headerAlign: 'right',
        valueGetter: (params) => params.row.seeds.toNumber(),
        renderCell: (params) => (
          <Stack
            direction="row"
            justifyContent="flex-end"
            alignItems="center"
            gap={0.25}
          >
            <TokenIcon token={SEEDS} />
            <Typography>
              {params.row.seeds.toFormat(2, BigNumberJS.ROUND_HALF_CEIL)}
            </Typography>
          </Stack>
        ),
        sortable: true,
      },
    ];

    return cols;
  }, [selectType, selected, token]);

  const handleSelect = (id: string) => {
    if (selectType === 'view') return;
    const newSelected = new Set([...selected]);

    if (selectType === 'single') {
      const exists = newSelected.has(id);
      newSelected.clear();
      if (!exists) {
        setSelected(newSelected.add(id));
        setModalOpen(true);
        return;
      }
    }
    if (!newSelected.delete(id)) newSelected.add(id);
    setSelected(newSelected);
  };

  const handleModalClose = () => {
    if (selectType === 'single' && !!selected.size) {
      setSelected(new Set());
    }
    setModalOpen(false);
  };

  const isSelectableType = selectType !== 'view';
  const state = !account ? 'disconnected' : 'ready';

  return (
    <>
      <TableCard
        title="Deposits"
        onRowClick={(e) => handleSelect(e.row.id)}
        rows={rows}
        columns={columns}
        state={state}
        maxRows={10}
        density="standard"
        onlyTable
        rowSpacing={1}
        rowHeight={65}
        {...(rows.length < 10 ? { hideFooter: true } : {})}
        tableCss={{
          ...baseTableCSS,
          px: 0,
          // pt: 0,
          '& .MuiDataGrid-row': {
            ...baseRowCSS,
            cursor: isSelectableType ? 'pointer' : 'default',
          },
        }}
      />
      {account && selectedDeposits.length === 1 && (
        <Dialog open={modalOpen} onClose={handleModalClose}>
          <SingleTokenDepositDialogContent
            row={selectedDeposits[0]}
            account={account}
            token={token}
          />
        </Dialog>
      )}
    </>
  );
};

export default TokenDeposits;

// ---------- Dialog ----------

const sharedButtonProps = {
  sx: (theme: any) => ({
    color: 'text.primary',
    borderColor: BeanstalkPalette.blue,
    borderRadius: '4px',
    fontWeight: FontWeight.medium,
    px: 1,
    py: 0.75,
    ':hover': {
      borderColor: BeanstalkPalette.blue,
      background: BeanstalkPalette.lightestBlue,
    },
    width: 'fit-content',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  }),
  variant: 'outlined',
  size: 'small',
} as const;

const SingleTokenDepositDialogContent = ({
  row,
  account,
  token,
}: {
  row: TokenDepositRow;
  token: Token;
  account: string;
}) => (
  <Stack p={2} gap={2} width="100%" maxWidth={{ xs: '100%', md: '491px' }}>
    {/* Deposit */}
    <Row justifyContent="space-between" alignItems="flex-start">
      <Typography>Deposit Owner</Typography>
      <Row gap={0.5}>
        <AddressIcon address={account} size={IconSize.xs} />
        <Typography>{trimAddress(account)}</Typography>
      </Row>
    </Row>
    <Row justifyContent="space-between" alignItems="flex-start">
      <Typography>Deposit Id</Typography>
      <Typography>{row.id}</Typography>
    </Row>
    {/* Deposit Amount */}
    <Row justifyContent="space-between" alignItems="flex-start">
      <Typography>Value</Typography>
      <Stack justifyContent="flex-start" alignItems="flex-end">
        <Row gap={0.3}>
          <TokenIcon token={token} css={{ height: '16px' }} />
          <Typography>
            {row.amount.toFormat(2, BigNumberJS.ROUND_HALF_CEIL)}
          </Typography>
        </Row>
        <Typography color="text.secondary" variant="bodySmall">
          <Fiat token={token} amount={row.amount} />
        </Typography>
      </Stack>
    </Row>
    {/* Deposit Stalk */}
    <Stack>
      <Row justifyContent="space-between" alignItems="flex-start">
        <Typography>Stalk</Typography>
        <Row gap={0.3}>
          <TokenIcon token={STALK} css={{ maxHeight: '1em' }} />
          <Typography>
            {row.stalk.total.toFormat(2, BigNumberJS.ROUND_DOWN)}
          </Typography>
        </Row>
      </Row>
      <Row justifyContent="space-between" alignItems="flex-start">
        <Typography
          color="text.secondary"
          variant="bodySmall"
          fontWeight={FontWeight.normal}
        >
          At time of Deposit
        </Typography>
        <Typography
          color="text.secondary"
          variant="bodySmall"
          fontWeight={FontWeight.normal}
        >
          {row.stalk.base.toFormat(2, BigNumberJS.ROUND_DOWN)}
        </Typography>
      </Row>
      <Row justifyContent="space-between" alignItems="flex-start">
        <Typography
          color="text.secondary"
          variant="bodySmall"
          fontWeight={FontWeight.normal}
        >
          Grown since Deposit
        </Typography>
        <Typography
          color="text.secondary"
          variant="bodySmall"
          fontWeight={FontWeight.normal}
        >
          {row.stalk.grown.toFormat(2, BigNumberJS.ROUND_DOWN)}
        </Typography>
      </Row>
    </Stack>
    <Row justifyContent="space-between" alignItems="flex-start">
      <Typography>Seed</Typography>
      <Row gap={0.3}>
        <TokenIcon token={SEEDS} css={{ height: '16px' }} />
        <Typography>{row.seeds.toFormat(2, BigNumberJS.ROUND_DOWN)}</Typography>
      </Row>
    </Row>

    <Row
      direction={{ xs: 'column', sm: 'row' }}
      gap={1}
      justifyContent="space-between"
    >
      <Button {...sharedButtonProps}>Transfer</Button>
      <Button {...sharedButtonProps}>Update Deposit</Button>
      <Button {...sharedButtonProps}>View on Etherscan</Button>
    </Row>
  </Stack>
);

// ---------- Components + Utils ----------

const CircleSelect = ({ isSelected }: { isSelected: boolean }) => {
  const Component = isSelected ? CheckCircleRounded : CircleOutlined;

  return (
    <Component
      sx={{
        height: '16px',
        width: 'auto',
        fill: isSelected ? BeanstalkPalette.logoGreen : undefined,
        color: !isSelected ? BeanstalkPalette.blue : undefined,
      }}
    />
  );
};

const baseTableCSS = {
  '& .MuiDataGrid-root': {
    '& .MuiDataGrid-cell': {
      outline: 'none',
    },
    '& .MuiDataGrid-virtualScrollerRenderZone': {
      '& .MuiDataGrid-row': {
        marginBottom: '10px',
      },
    },
    '& .MuiDataGrid-renderingZone': {
      maxHeight: 'none !important',
      maxWidth: '100% !important',
    },
    '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within':
      { outline: 'none' },
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontWeight: FontWeight.medium,
    fontSize: FontSize.base,
  },
} as const;

const baseRowCSS = {
  background: 'white',
  borderRadius: '10px',
  boxSizing: 'border-box',
  outline: '1px solid',
  outlineColor: 'white',
  outlineOffset: '-1px',
  maxHeight: 'none !important',
  width: '100%',
  '&:hover': {
    outlineColor: BeanstalkPalette.blue,
    backgroundColor: BeanstalkPalette.lightestBlue,
  },
  '& >.MuiDataGrid-cell': {
    minHeight: '65px !important',
    maxHeight: '65px !important',
  },
} as const;
