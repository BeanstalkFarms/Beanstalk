import React from 'react';
import { Chip, Tooltip, Typography } from '@mui/material';
import {
  GridColumns,
  GridRenderCellParams,
  GridValueFormatterParams,
} from '@mui/x-data-grid';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import BigNumber from 'bignumber.js';
import { displayBN, displayFullBN, MaxBN } from '~/util';
import { BEAN, PODS } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import { PodListing, PodOrder } from '~/state/farmer/market';
import TokenIcon from '../TokenIcon';
import AddressIcon from '../AddressIcon';
import Row from '~/components/Common/Row';
import { BeanstalkPalette } from '~/components/App/muiTheme';

const basicCell = (params: GridRenderCellParams) => (
  <Typography>{params.formattedValue}</Typography>
);

const COLUMNS = {
  ///
  /// Generics
  ///
  depositId: (header: string) => ({
    // The field is always `stem`, we just change the header for legacy seasons
    field: 'stem',
    flex: 0.8,
    headerName: header,
    align: 'left',
    headerAlign: 'left',
    valueFormatter: (params: GridValueFormatterParams) =>
      params.value.toString(),
    renderCell: (params: GridRenderCellParams) => (
      <Tooltip
        placement="bottom"
        title={(params.formattedValue <= 0) && "Stems represent the Stalk Grown per BDV of Deposited value. This value starts at 0 at the time of Stem deployment (the Silo V3 BIP), or when a new token is added to the Deposit Whitelist."}
      >
        <Typography>{params.formattedValue}</Typography>
      </Tooltip>
    ),
    sortable: false,
  }),

  ///
  /// Silo
  ///
  seeds: {
    field: 'seeds',
    flex: 1,
    headerName: 'Seeds',
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) =>
      displayFullBN(params.value, 2),
    renderCell: (params: GridRenderCellParams) => (
      <>
        <Typography display={{ xs: 'none', md: 'block' }}>
          {displayFullBN(params.value, 2)}
        </Typography>
        <Typography display={{ xs: 'block', md: 'none' }}>
          {displayBN(params.value)}
        </Typography>
      </>
    ),
    sortable: false,
  } as GridColumns[number],

  ///
  /// Pod Market
  ///
  numPods: (flex: number) =>
    ({
      field: 'totalAmount',
      headerName: 'Amount',
      type: 'number',
      flex: flex,
      // disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip
          placement="right"
          title={
            <>
              Total Value:{' '}
              {displayFullBN(
                (params.value as BigNumber).times(params.row.pricePerPod),
                BEAN[1].displayDecimals
              )}{' '}
              BEAN
            </>
          }
        >
          <Row gap={0.3}>
            <TokenIcon token={PODS} />
            <Typography>{displayBN(params.value)}</Typography>
          </Row>
        </Tooltip>
      ),
    } as GridColumns[number]),

  numPodsActive: (flex: number) =>
    ({
      field: 'remainingAmount',
      headerName: 'Amount',
      flex: flex,
      type: 'number',
      // disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<any, PodListing>) => (
        <Tooltip
          placement="right"
          title={
            <>
              Total Value:{' '}
              {displayFullBN(
                (params.value as BigNumber).times(params.row.pricePerPod),
                BEAN[1].displayDecimals
              )}{' '}
              BEAN
            </>
          }
        >
          <Row gap={0.3}>
            <TokenIcon token={PODS} />
            <Typography>{displayBN(params.row.remainingAmount)}</Typography>
          </Row>
        </Tooltip>
      ),
    } as GridColumns[number]),
  pricePerPod: (flex: number) =>
    ({
      field: 'pricePerPod',
      headerName: 'Price per Pod',
      type: 'number',
      align: 'left',
      headerAlign: 'left',
      flex: flex,
      renderCell: (
        params: GridRenderCellParams<any, PodListing | PodOrder>
      ) => (
        <Row gap={0.3}>
          <TokenIcon token={BEAN[1]} />
          <Typography>{displayFullBN(params.value)}</Typography>
        </Row>
      ),
    } as GridColumns[number]),

  fromAccount: {
    field: 'account',
    headerName: 'From',
    flex: 0,
    renderCell: (params: GridRenderCellParams) => (
      <Typography color="primary">{params.value.substring(0, 6)}</Typography>
    ),
  } as GridColumns[number],

  // https://mui.com/x/react-data-grid/column-definition/#converting-types
  plotIndex: (harvestableIndex: BigNumber, flex: number) =>
    ({
      field: 'index',
      headerName: 'Place in Line',
      flex: flex,
      type: 'number',
      align: 'left',
      headerAlign: 'left',
      valueGetter: (params: GridRenderCellParams) =>
        params.value - harvestableIndex.toNumber(),
      renderCell: (params: GridRenderCellParams) => (
        <>
          <Typography display={{ xs: 'none', md: 'block' }}>
            {displayFullBN(new BigNumber(params.value), 0)}
          </Typography>
          <Typography display={{ xs: 'block', md: 'none' }}>
            {displayBN(new BigNumber(params.value))}
          </Typography>
        </>
      ),
    } as GridColumns[number]),
  maxPlaceInLine: (flex: number) =>
    ({
      field: 'maxPlaceInLine',
      headerName: 'Place in Line',
      type: 'number',
      flex: flex,
      align: 'left',
      headerAlign: 'left',
      valueGetter: (params: GridRenderCellParams) =>
        (params.value as BigNumber).toNumber(),
      renderCell: (params: GridRenderCellParams) => (
        <>
          <Typography display={{ xs: 'none', md: 'block' }}>
            0 - {displayFullBN(new BigNumber(params.value), 0)}
          </Typography>
          <Typography display={{ xs: 'block', md: 'none' }}>
            0 - {displayBN(new BigNumber(params.value))}
          </Typography>
        </>
      ),
    } as GridColumns[number]),
  expiry: (harvestableIndex: BigNumber, flex: number) =>
    ({
      field: 'maxHarvestableIndex',
      headerName: 'Expires in',
      flex: flex,
      value: 'number',
      align: 'right',
      headerAlign: 'right',
      filterable: false, // TODO: make this filterable
      renderCell: (params: GridRenderCellParams) => {
        const expiresIn = MaxBN(
          (params.value as BigNumber).minus(harvestableIndex),
          ZERO_BN
        );
        const tip = expiresIn?.gt(0) ? (
          <>
            If the Pod Line moves forward{' '}
            {displayFullBN(
              (params.value as BigNumber).minus(harvestableIndex),
              PODS.displayDecimals
            )}{' '}
            Pods, this Listing will expire.
          </>
        ) : (
          ''
        );
        return (
          <Tooltip placement="right" title={tip}>
            <Typography>{displayBN(expiresIn)} Pods</Typography>
          </Tooltip>
        );
      },
    } as GridColumns[number]),
  status: (harvestableIndex: BigNumber) =>
    ({
      field: 'status',
      headerName: 'Status',
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title="">
          <Typography>
            {params.row.status === 'filled' ? (
              <Chip color="primary" label="Filled" variant="filled" />
            ) : /// FIXME: right now the event processor doesn't flag
            /// listings as expired, so we override status here.
            harvestableIndex.gte(
                params.row.maxHarvestableIndex as BigNumber
              ) ? (
              <Chip color="warning" label="Expired" variant="filled" />
            ) : (
              <Chip color="secondary" label="Active" variant="filled" />
            )}
          </Typography>
        </Tooltip>
      ),
    } as GridColumns[number]),

  ///
  /// Extras
  ///
  connectedAccount: {
    field: 'connectedAccount',
    headerName: '',
    width: 10,
    sortable: false,
    filterable: false,
    renderCell: () => <AddressIcon />,
  } as GridColumns[number],
  rightChevron: {
    field: 'rightChevron',
    headerName: '',
    width: 20,
    sortable: false,
    filterable: false,
    renderCell: () => (
      <ArrowRightIcon sx={{ color: BeanstalkPalette.lightestGrey }} />
    ),
  } as GridColumns[number],
};

export default COLUMNS;
