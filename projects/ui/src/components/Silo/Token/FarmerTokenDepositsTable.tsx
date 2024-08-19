/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useMemo, useState } from 'react';
import { ERC20Token, Token, TokenValue } from '@beanstalk/sdk-core';
import BigNumberJS from 'bignumber.js';
import { BigNumber } from 'ethers';
import useStemTipForToken from '~/hooks/beanstalk/useStemTipForToken';
import useSdk from '~/hooks/sdk';

import { useAccount } from 'wagmi';
import { formatTV, transform, trimAddress } from '~/util';
import { GridColumns } from '@mui/x-data-grid';
import {
  Box,
  Button,
  Dialog,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
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
import { minimizeWindowIcon } from '~/img/icon';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import { Deposit } from '@beanstalk/sdk';
import { useAppSelector } from '~/state';
import {
  TokenDepositsContextType,
  TokenDepositsSelectType,
  useTokenDepositsContext,
} from './TokenDepositsContext';

export type FarmerTokenDepositRow = Deposit<TokenValue> & {
  id: string;
  mowableStalk: TokenValue;
};

const FarmerTokenDepositsTable = ({
  token,
  selectType = 'single',
}: {
  token: Token;
  selectType?: TokenDepositsSelectType;
}) => {
  const sdk = useSdk();
  const theme = useTheme();
  const { address: account } = useAccount();
  const { selected, depositsById, setSelected, clear, setSlug } =
    useTokenDepositsContext();
  const mowStatus = useAppSelector((s) => s._farmer.silo.mowStatuses);

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const newToken = sdk.tokens.findBySymbol(token.symbol) as ERC20Token;
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const stemTip = useStemTipForToken(newToken) || BigNumber.from(0);
  const lastStem = mowStatus.get(token)?.lastStem || BigNumber.from(0);
  const deltaStem = transform(stemTip.sub(lastStem), 'bnjs').div(1_000_000);

  const rows: FarmerTokenDepositRow[] = useMemo(() => {
    const rowData = Object.entries(depositsById).map(([key, deposit]) => ({
      id: key,
      mowableStalk: deposit.bdv?.mul(deltaStem.toNumber()).div(10000),
      ...deposit,
    }));
    return rowData;
  }, [depositsById, deltaStem]);

  const selectedDeposits = rows.filter((row) => selected.has(row.id));

  const columns = React.useMemo(() => {
    const cols: GridColumns<FarmerTokenDepositRow> = [
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
        flex: isMobile ? 1 : 0.9,
        headerName: 'Amount',
        align: isMobile ? 'left' : 'right',
        headerAlign: isMobile ? 'left' : 'right',
        valueGetter: (params) => params.row.amount.toNumber(),
        renderCell: (params) => (
          <Stack width="100%">
            <Typography textAlign={{ xs: 'left', md: 'right' }}>
              <TokenIcon token={token} css={{ marginBottom: '-2px' }} />{' '}
              {formatTV(params.row.amount, 2)}
            </Typography>
            <Typography
              color="text.secondary"
              textAlign={{ xs: 'left', md: 'right' }}
            >
              <Fiat token={token} amount={params.row.amount} />
            </Typography>
          </Stack>
        ),
        sortable: true,
      },
      {
        field: 'stalk',
        flex: isMobile ? 1 : 1.4,
        headerName: 'Stalk',
        align: 'right',
        headerAlign: 'right',
        valueGetter: (params) => params.row.stalk.total.toNumber(),
        renderCell: (params) => (
          <Stack alignItems="flex-end">
            <Typography align="right">
              <TokenIcon token={STALK} />
              {formatTV(params.row.stalk.total, 2)}
            </Typography>
            <Typography
              align="right"
              color="text.secondary"
              display="inline-flex"
            >
              Grown
              <Typography
                component="span"
                display={{ xs: 'none', md: 'block' }}
                ml={{ xs: 0, md: 0.25 }}
              >
                since Deposit
              </Typography>
              : {formatTV(params.row.stalk.grown, 2)}
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
              {formatTV(params.row.seeds, 2, BigNumberJS.ROUND_HALF_CEIL)}
            </Typography>
          </Stack>
        ),
        sortable: true,
      },
    ];

    return cols;
  }, [isMobile, selectType, selected, token]);

  const handleSelect = (id: string) => {
    const selectCallback =
      selectType === 'single' ? () => setModalOpen(true) : undefined;
    setSelected(id, selectType, selectCallback);
  };

  const handleModalClose = () => {
    clear();
    setModalOpen(false);
  };

  const state = !account ? 'disconnected' : 'ready';

  return (
    <>
      <TableCard
        title="Deposits"
        onRowClick={(e) => handleSelect(e.row.id)}
        rows={rows}
        columns={columns}
        state={state}
        density="standard"
        onlyTable
        rowSpacing={1}
        rowHeight={65}
        maxRows={isMobile ? 5 : 10}
        columnVisibilityModel={{
          id: !isMobile,
          amount: true,
          stalk: true,
          seeds: true,
        }}
        tableCss={baseTableCSS}
        classes={{
          cell: 'data-grid-cell-overflow',
        }}
      />
      {account && selectedDeposits.length === 1 && (
        <Dialog open={modalOpen} onClose={handleModalClose}>
          <SingleTokenDepositDialogContent
            row={selectedDeposits[0]}
            account={account}
            token={token}
            setSlug={setSlug}
          />
        </Dialog>
      )}
    </>
  );
};

export default FarmerTokenDepositsTable;

const SingleTokenDepositDialogContent = ({
  row,
  account,
  token,
  setSlug,
}: {
  row: FarmerTokenDepositRow;
  token: Token;
  account: string;
  setSlug: TokenDepositsContextType['setSlug'];
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
        <Row gap={0.5}>
          <TokenIcon token={token} css={{ height: '16px' }} />
          <Typography>
            {formatTV(row.amount, 2, BigNumberJS.ROUND_HALF_CEIL)}
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
        <Row gap={0.25}>
          <TokenIcon token={STALK} css={{ maxHeight: '1em' }} />
          <Typography>
            {formatTV(row.stalk.total, 2, BigNumberJS.ROUND_HALF_CEIL)}
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
          {formatTV(row.stalk.base, 2, BigNumberJS.ROUND_HALF_CEIL)}
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
          {formatTV(row.stalk.grown, 2, BigNumberJS.ROUND_HALF_CEIL)}
        </Typography>
      </Row>
    </Stack>
    <Row justifyContent="space-between" alignItems="flex-start">
      <Typography>Seed</Typography>
      <Row gap={0.3}>
        <TokenIcon token={SEEDS} css={{ height: '16px' }} />
        <Typography>
          {formatTV(row.seeds, 2, BigNumberJS.ROUND_HALF_CEIL)}
        </Typography>
      </Row>
    </Row>
    <Row
      direction={{ xs: 'column', sm: 'row' }}
      gap={1}
      justifyContent="space-between"
      sx={(t) => ({
        button: {
          [t.breakpoints.down('sm')]: {
            width: '100%',
          },
          'img, svg': {
            height: '16px',
            width: 'auto',
          },
        },
      })}
    >
      <Button
        variant="outlined-secondary"
        color="secondary"
        size="small"
        startIcon={<Box component="img" src={minimizeWindowIcon} />}
        onClick={() => setSlug('transfer')}
      >
        Transfer
      </Button>
      <Button
        variant="outlined-secondary"
        color="secondary"
        size="small"
        startIcon={<Box component="img" src={minimizeWindowIcon} />}
        onClick={() => setSlug('lambda')}
      >
        Update Deposit
      </Button>
      <Button
        variant="outlined-secondary"
        color="secondary"
        size="small"
        endIcon={<NorthEastIcon />}
      >
        View on Etherscan
      </Button>
    </Row>
  </Stack>
);

// ---------- Components ----------

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

// ---------- CSS ----------

const baseTableCSS = {
  px: 0,
  '& .MuiDataGrid-root': {
    '& .MuiDataGrid-cell': {
      outline: 'none',
      overflow: 'visible',
      '&:active': {
        outline: 'none',
      },
    },
    '& .MuiDataGrid-virtualScrollerRenderZone': {
      '& .MuiDataGrid-row:not(:last-child)': {
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
  '& .MuiDataGrid-cell': {
    outline: 'none',
    '&:active': {
      outline: 'none',
    },
  },

  '& .MuiDataGrid-row': {
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
      backgroundColor: `${BeanstalkPalette.lightestBlue} !important`,
    },
    '& >.MuiDataGrid-cell': {
      minHeight: '63px !important',
      maxHeight: '63px !important',
    },
    cursor: 'pointer',
  },

  // enable overflow of text in cells
  '.data-grid-cell-overflow': {
    whiteSpace: 'nobreak !important',
    overflow: 'visible !important',
  },
} as const;
