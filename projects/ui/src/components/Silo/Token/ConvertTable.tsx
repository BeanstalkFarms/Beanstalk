/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useMemo } from 'react';
import { Deposit, ERC20Token, TokenValue } from '@beanstalk/sdk';
import { Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { GridColumns } from '@mui/x-data-grid';
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
  deltaStalk: TokenValue;
  deltaSeed: TokenValue;
};

const ConvertTable = ({
  token,
  rows,
  selectType = 'single',
}: {
  token: ERC20Token;
  rows: FarmerTokenConvertRow[];
  selectType: TokenDepositsSelectType;
}) => {
  const sdk = useSdk();
  const theme = useTheme();
  const account = useAccount();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { slug, selected, setSelected } = useTokenDepositsContext();

  const isMultiSelect = selectType === 'multi';
  const isLambdaView = slug === 'lambda';

  const columns = useMemo(() => {
    const baseColumns: GridColumns<FarmerTokenConvertRow> = [
      {
        field: 'id',
        // flex: 1.5,
        width: 170,
        headerName: 'Deposits',
        align: 'left',
        headerAlign: 'left',
        cellClassName: 'sticky-col',
        headerClassName: 'sticky-col',
        valueGetter: (params) => params.row.id.toString(),
        renderCell: (params) => (
          <Stack direction="row" gap={0.5} alignItems="center">
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
    ];

    if (!isLambdaView) {
      const ownerColumn: GridColumns<FarmerTokenConvertRow>[number] = {
        field: 'owner',
        // flex: 1,
        width: 250,
        headerName: 'Owner',
        align: 'left',
        valueGetter: (params) => params.row.owner || '',
        renderCell: (params) => (
          <Typography>{trimAddress(params.row.owner || '')}</Typography>
        ),
        sortable: true,
      };
      baseColumns.push(ownerColumn);
    }

    const restColumns: GridColumns<FarmerTokenConvertRow> = [
      {
        field: 'recordedBDV',
        // flex: 1,
        width: 130,
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
        flex: 0,
        width: 20,
        align: 'right',
        headerAlign: 'right',
        headerName: '',
        sortable: true,
        // valueGetter: (params) => params.row.bdv.toNumber(),
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
        // flex: 1,
        width: 140,
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
        // flex: 1,
        width: 140,
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
        // flex: 0.75,
        width: 140,
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
    ];

    return baseColumns.concat(restColumns);
  }, [isLambdaView, isMultiSelect, selected, token.symbol, sdk.tokens.SEEDS]);

  const getSelectedRowClassName = (params: { row: FarmerTokenConvertRow }) => {
    if (selected.has(params.row.id)) {
      return 'selected-row';
    }
    return 'row';
  };

  const state = !account ? 'disconnected' : 'ready';

  return (
    <>
      <TableCard
        title=""
        onRowClick={(e) => setSelected(e.row.id, selectType)}
        rows={rows}
        columns={columns}
        state={state}
        density="standard"
        onlyTable
        rowSpacing={1}
        rowHeight={65}
        maxRows={isMobile ? 5 : 10}
        tableCss={baseTableCSS}
        getRowClassName={getSelectedRowClassName}
        classes={{
          cell: 'data-grid-cell-overflow',
        }}
      />
    </>
  );
};

export default ConvertTable;

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
