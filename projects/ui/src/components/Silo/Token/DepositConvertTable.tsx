/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useCallback, useMemo } from 'react';
import { Deposit, ERC20Token, TokenValue } from '@beanstalk/sdk';
import { Stack, Theme, Typography, useMediaQuery } from '@mui/material';
import { GridColumns, GridEventListener } from '@mui/x-data-grid';
import useSdk from '~/hooks/sdk';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CircleOutlined from '@mui/icons-material/CircleOutlined';
import {
  BeanstalkPalette,
  FontSize,
  FontWeight,
} from '~/components/App/muiTheme';
import { formatTV, trimAddress } from '~/util';
import TokenIcon from '~/components/Common/TokenIcon';
import useAccount from '~/hooks/ledger/useAccount';
import TableCard from '~/components/Common/TableCard';
import { LongArrowRight } from '~/components/Common/SystemIcons';
import {
  TokenDepositsSelectType,
  useTokenDepositsContext,
} from './TokenDepositsContext';

export type FarmerTokenConvertRow = Deposit<TokenValue> & {
  id: string;
  owner?: string;
  currentBDV: TokenValue;
  deltaBDV: TokenValue;
  deltaStalk: TokenValue;
  deltaSeed: TokenValue;
};

export type ConvertTableColumn =
  | 'deposits'
  | 'owner'
  | 'recordedBDV'
  | 'arrow'
  | 'currentBDV'
  | 'deltaStalk'
  | 'deltaSeed';

type BaseProps = {
  token: ERC20Token;
  selectType: TokenDepositsSelectType;
};

const SLUG_COL_CONFIG: Record<
  string,
  {
    desktop: readonly ConvertTableColumn[];
    mobile: readonly ConvertTableColumn[];
  }
> = {
  lambda: {
    desktop: [
      'deposits',
      'recordedBDV',
      'arrow',
      'currentBDV',
      'deltaStalk',
      'deltaSeed',
    ],
    mobile: ['deposits', 'recordedBDV', 'arrow', 'currentBDV'],
  },
  'anti-lambda': {
    desktop: [
      'deposits',
      'owner',
      'recordedBDV',
      'arrow',
      'currentBDV',
      'deltaStalk',
      'deltaSeed',
    ],
    mobile: ['deposits', 'owner', 'recordedBDV', 'arrow', 'currentBDV'],
  },
} as const;

const DepositConvertTable = ({
  token,
  rows,
  selectType = 'single',
}: BaseProps & {
  rows: FarmerTokenConvertRow[];
}) => {
  const account = useAccount();
  const { slug, selected, setSelected } = useTokenDepositsContext();
  const sdk = useSdk();

  const isMobile = useMediaQuery((t: Theme) => t.breakpoints.down('md'));

  const isMultiSelect = selectType === 'multi';
  const isLambdaView = slug === 'lambda';

  const allColumns = useMemo<GridColumns<FarmerTokenConvertRow>>(
    () => [
      {
        field: 'deposits',
        flex: 1,
        minWidth: 150,
        headerName: 'Deposits',
        align: 'left',
        headerAlign: 'left',
        valueGetter: (params) => params.row.id.toString(),
        renderCell: (params) => (
          <Stack direction="row" gap={1} alignItems="center">
            {isMultiSelect && (
              <CircleSelect isSelected={selected.has(params.row.id)} />
            )}
            <Stack>
              <Typography>{token.symbol} Deposit</Typography>
              <Typography color="text.secondary" fontWeight={FontWeight.normal}>
                {params.row.id}
              </Typography>
            </Stack>
          </Stack>
        ),
        sortable: true,
      },
      {
        field: 'owner',
        flex: 1,
        minWidth: 130,
        headerName: 'Owner',
        align: 'right',
        headerAlign: 'right',
        valueGetter: (params) => params.row.owner || '',
        renderCell: (params) => (
          <Typography>{trimAddress(params.row.owner || '')}</Typography>
        ),
        sortable: true,
      },
      {
        field: 'recordedBDV',
        flex: 0.75,
        minWidth: 130,
        align: 'left',
        headerAlign: 'left',
        headerName: 'Recorded BDV',
        sortable: true,
        valueGetter: (params) => params.row.bdv.toNumber(),
        renderCell: (params) => (
          <Typography>
            <TokenIcon
              token={sdk.tokens.SEEDS}
              css={{ marginBottom: '-3px' }}
            />{' '}
            {formatTV(params.row.bdv, 2)}
          </Typography>
        ),
      },
      {
        field: 'arrow',
        width: 20,
        maxWidth: 20,
        minWidth: 20,
        headerName: '',
        sortable: true,
        renderCell: (params) => {
          const isGain = params.row.bdv.lt(params.row.currentBDV);
          return (
            <LongArrowRight
              width={16}
              color={isGain ? BeanstalkPalette.logoGreen : BeanstalkPalette.red}
            />
          );
        },
      },
      {
        field: 'currentBDV',
        flex: 0.75,
        minWidth: 120,
        align: 'right',
        headerAlign: 'right',
        headerName: 'Current BDV',
        sortable: true,
        valueGetter: (params) => params.row.currentBDV.toNumber(),
        renderCell: (params) => (
          <Typography>
            <TokenIcon
              token={sdk.tokens.SEEDS}
              css={{ marginBottom: '-3px' }}
            />{' '}
            {formatTV(params.row.currentBDV, 2)}
          </Typography>
        ),
      },
      {
        field: 'deltaStalk',
        flex: 1,
        width: 140,
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        headerName: isLambdaView ? 'Gain in Stalk' : 'Loss in Stalk',
        sortable: true,
        valueGetter: (params) => params.row.deltaStalk.toNumber(),
        renderCell: (params) => {
          const isGain = params.row.deltaStalk.gte(0);
          return (
            <Typography
              variant="h4"
              sx={{
                whiteSpace: 'nowrap',
                color: isGain
                  ? BeanstalkPalette.logoGreen
                  : BeanstalkPalette.red,
              }}
            >
              {isGain ? '+' : '-'} {formatTV(params.row.deltaStalk, 0)}
            </Typography>
          );
        },
      },
      {
        field: 'deltaSeed',
        align: 'right',
        headerAlign: 'right',
        flex: 1,
        minWidth: 140,
        headerName: isLambdaView ? 'Gain in Seed' : 'Loss in Seed',
        sortable: true,
        valueGetter: (params) => params.row.deltaStalk.toNumber(),
        renderCell: (params) => {
          const isGain = params.row.deltaStalk.gte(0);
          return (
            <Typography
              variant="h4"
              sx={{
                whiteSpace: 'nowrap',
                color: isGain
                  ? BeanstalkPalette.logoGreen
                  : BeanstalkPalette.red,
              }}
            >
              {isGain ? '+' : '-'} {formatTV(params.row.deltaStalk, 0)}
            </Typography>
          );
        },
      },
    ],
    [isLambdaView, isMultiSelect, selected, token.symbol, sdk.tokens.SEEDS]
  );

  const getRowClassName = useCallback(
    (params: { row: FarmerTokenConvertRow }) =>
      selected.has(params.row.id) ? 'selected-row' : '',
    [selected]
  );

  const handleRowClick: GridEventListener<'rowClick'> = useCallback(
    (params) => {
      setSelected(params.row.id, selectType);
    },
    [setSelected, selectType]
  );

  const state = !account ? 'disconnected' : 'ready';

  const columns = allColumns.filter((col) =>
    SLUG_COL_CONFIG[slug]?.[isMobile ? 'mobile' : 'desktop']?.includes(
      col.field as ConvertTableColumn
    )
  );

  return (
    <>
      <TableCard
        title=""
        onRowClick={handleRowClick}
        rows={rows}
        columns={columns}
        getRowSpacing={(params) => ({
          bottom: params.isLastVisible ? 0 : 10,
        })}
        state={state}
        density="standard"
        onlyTable
        rowSpacing={1}
        rowHeight={65}
        maxRows={isMobile ? 5 : 10}
        tableCss={baseTableCSS}
        getRowClassName={getRowClassName}
        getCellClassName={getCellClassName}
      />
    </>
  );
};

const getCellClassName = (params: { field: string }) => {
  if (params.field === 'arrow') {
    return 'arrow-cell';
  }

  return 'data-grid-cell-overflow';
};

export default DepositConvertTable;

function CircleSelect({ isSelected }: { isSelected: boolean }) {
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
}

// ---------- CSS ----------

const baseTableCSS = {
  px: 0,
  '& .MuiDataGrid-root': {
    overflowY: 'hidden',
    '& .MuiDataGrid-cell': {
      outline: 'none',
      overflow: 'visible',
      '&:active': {
        outline: 'none',
      },
    },
    '& .MuiDataGrid-renderingZone': {
      overflowY: 'hidden',
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
    outlineOffset: '-2px',
    maxHeight: 'none !important',
    width: '100%',
    '&:hover': {
      outlineColor: BeanstalkPalette.logoGreen,
      backgroundColor: `${BeanstalkPalette.lightestGreen} !important`,
    },
    '& >.MuiDataGrid-cell': {
      minHeight: '65px !important',
      maxHeight: '65px !important',
      whiteSpace: 'normal',
      lineHeight: 'normal',
    },
    cursor: 'pointer',
  },

  '.arrow-cell': {
    padding: '0 !important',
    minWidth: '20px',
    maxWidth: '20px',
  },

  // enable overflow of text in cells
  '.data-grid-cell-overflow': {
    whiteSpace: 'nobreak !important',
    overflow: 'visible !important',
    outline: 'none',
  },

  '.selected-row': {
    background: `${BeanstalkPalette.lightestGreen} !important`,
    outlineColor: BeanstalkPalette.logoGreen,
  },
} as const;
