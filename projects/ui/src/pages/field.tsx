import React, { useMemo } from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import BigNumber from 'bignumber.js';
import { DataGridProps } from '@mui/x-data-grid';
import PageHeader from '~/components/Common/PageHeader';
import FieldActions from '~/components/Field/Actions';
import TableCard from '~/components/Common/TableCard';
import { displayBN, displayFullBN } from '~/util';
import FieldOverview from '~/components/Field/FieldOverview';
import { PODS } from '../constants/tokens';
import useAccount from '~/hooks/ledger/useAccount';
import GuideButton from '~/components/Common/Guide/GuideButton';
import {
  HOW_TO_HARVEST_PODS,
  HOW_TO_SOW_BEANS,
  HOW_TO_TRANSFER_PODS,
} from '~/util/Guides';

import { FC } from '~/types';
import { XXLWidth } from '~/components/App/muiTheme';
import { AppState } from '~/state';

export const podlineColumns: DataGridProps['columns'] = [
  {
    field: 'placeInLine',
    headerName: 'Place In Line',
    flex: 1,
    renderCell: (params) =>
      params.value.eq(-1) ? (
        <Typography color="primary">Harvestable</Typography>
      ) : (
        <Typography>{displayBN(params.value)}</Typography>
      ),
  },
  {
    field: 'amount',
    headerName: 'Number of Pods',
    flex: 1,
    disableColumnMenu: true,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params) =>
      `${displayFullBN(params.value as BigNumber, 2)}`,
    renderCell: (params) => <Typography>{params.formattedValue}</Typography>,
  },
];

const FieldPage: FC<{}> = () => {
  const account = useAccount();
  const authState = !account ? 'disconnected' : 'ready';

  /// Data
  const farmerField = useSelector<AppState, AppState['_farmer']['field']>(
    (state) => state._farmer.field
  );
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );

  const harvestablePods = farmerField.harvestablePods;

  const rows: any[] = useMemo(() => {
    const data: any[] = [];
    if (harvestablePods?.gt(0)) {
      data.push({
        id: harvestablePods,
        placeInLine: new BigNumber(-1),
        amount: harvestablePods,
      });
    }
    if (Object.keys(farmerField.plots).length > 0) {
      data.push(
        ...Object.keys(farmerField.plots).map((index) => ({
          id: index,
          placeInLine: new BigNumber(index).minus(
            beanstalkField.harvestableIndex
          ),
          amount: new BigNumber(farmerField.plots[index]),
        }))
      );
    }
    return data;
  }, [beanstalkField.harvestableIndex, farmerField.plots, harvestablePods]);

  return (
    <Container sx={{ maxWidth: `${XXLWidth}px !important`, width: '100%' }}>
      <Stack spacing={2} width="100%">
        <PageHeader
          title="The Field"
          description="Earn yield by lending Beans to Beanstalk"
          href="https://docs.bean.money/almanac/farm/field"
          OuterStackProps={{ direction: 'row' }}
          control={
            <GuideButton
              title="The Farmers' Almanac: Field Guides"
              guides={[
                HOW_TO_SOW_BEANS,
                HOW_TO_TRANSFER_PODS,
                HOW_TO_HARVEST_PODS,
              ]}
            />
          }
        />
        <Stack gap={2} direction={{ xs: 'column', lg: 'row' }} width="100%">
          <Box width="100%" height="100%" sx={{ minWidth: 0 }}>
            <FieldOverview beanstalkField={beanstalkField} />
          </Box>
          <Stack gap={2} width="100%" maxWidth={{ lg: '470px' }}>
            <FieldActions />
            <TableCard
              title="Pod Balance"
              state={authState}
              amount={farmerField.pods}
              rows={rows}
              columns={podlineColumns}
              sort={{ field: 'placeInLine', sort: 'asc' }}
              token={PODS}
            />
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
};
export default FieldPage;
