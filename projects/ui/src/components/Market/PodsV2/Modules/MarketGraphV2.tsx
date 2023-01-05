import { Button, Stack, Typography } from '@mui/material';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import React from 'react';
import Row from '~/components/Common/Row';
import useMarketData from '~/hooks/beanstalk/useMarketData';
import { displayBN } from '~/util';
import {
  marketBottomTabsAtom,
  selectedListingAtom,
  selectedOrderAtom,
} from '../info/atom-context';
import ChartTypePill from '../Common/ChartTypePill';

const SelectedOrdersTemp: React.FC<{}> = () => {
  const [selectedOrder, selectOrder] = useAtom(selectedOrderAtom);

  return (
    <Stack gap={2} width="100%" maxWidth="300px">
      <Typography variant="h4">SELECTED ORDER</Typography>
      {selectedOrder && (
        <Button
          variant="outlined"
          sx={{ color: 'text.primary', p: 1, height: '100px' }}
          onClick={() => selectOrder(null)}
        >
          <Stack width="100%" gap={0.5}>
            <Row justifyContent="space-between">
              <Typography variant="body1">price per pod</Typography>
              <Typography variant="body1">
                {displayBN(selectedOrder.pricePerPod)}
              </Typography>
            </Row>
            <Row justifyContent="space-between">
              <Typography variant="body1">max place in line</Typography>
              <Typography variant="body1">
                {displayBN(selectedOrder.maxPlaceInLine)}
              </Typography>
            </Row>
            <Row justifyContent="space-between">
              <Typography variant="body1">amount</Typography>
              <Typography variant="body1">
                {displayBN(selectedOrder.podAmountRemaining)}
              </Typography>
            </Row>
          </Stack>
        </Button>
      )}
    </Stack>
  );
};

const SelectedListingsTemp: React.FC<{}> = () => {
  const [selected, setSelected] = useAtom(selectedListingAtom);
  return (
    <Stack gap={2} width="100%" maxWidth="300px">
      <Typography variant="h4">SELECTED LISTING</Typography>
      {selected && (
        <Button
          variant="outlined"
          sx={{ color: 'text.primary', p: 1 }}
          onClick={() => setSelected(null)}
        >
          <Stack width="100%" gap={0.5}>
            <Row justifyContent="space-between">
              <Typography variant="body1">amount</Typography>
              <Typography variant="body1">
                {displayBN(selected?.amount)}
              </Typography>
            </Row>
            <Row justifyContent="space-between">
              <Typography variant="body1">place inline</Typography>
              <Typography variant="body1">
                {displayBN(selected?.placeInLine)}
              </Typography>
            </Row>
          </Stack>
        </Button>
      )}
    </Stack>
  );
};

const PodsChart: React.FC<{}> = () => {
  const openState = useAtomValue(marketBottomTabsAtom);
  const data = useMarketData();
  const selectListing = useSetAtom(selectedListingAtom);
  const selectOrder = useSetAtom(selectedOrderAtom);

  return (
    <Stack
      sx={{
        maxHeight: openState === 2 ? '0%' : '100%',
        overflow: 'hidden',
        transition: 'max-height 200ms ease-in',
        height: '100%',
      }}
    >
      <Stack
        direction="row"
        width="100%"
        height="100%"
        sx={{ backgroundColor: 'green', position: 'relative' }}
      >
        {/* chart type pill overlay */}
        <ChartTypePill pos={{ right: 8, top: 8 }} />
        {/** LISTINGS */}
        <Stack
          width="100%"
          maxWidth="300px"
          maxHeight="500px"
          sx={{ overflowY: 'scroll' }}
          p={1}
          gap={1}
        >
          <Typography variant="h4">LISTINGS</Typography>
          <Stack gap={1} width="100%" px={0.5}>
            {data.listings?.map((listing, i) => (
              <Button
                variant="outlined"
                key={`listing-${i}`}
                sx={{ color: 'text.primary', p: 1 }}
                onClick={() => selectListing(listing)}
              >
                <Stack width="100%" gap={0.5}>
                  <Row justifyContent="space-between">
                    <Typography variant="body1">amount</Typography>
                    <Typography variant="body1">
                      {displayBN(listing.amount)}
                    </Typography>
                  </Row>
                  <Row justifyContent="space-between">
                    <Typography variant="body1">place inline</Typography>
                    <Typography variant="body1">
                      {displayBN(listing.placeInLine)}
                    </Typography>
                  </Row>
                </Stack>
              </Button>
            ))}
          </Stack>
        </Stack>
        <Stack
          width="100%"
          maxWidth="300px"
          maxHeight="500px"
          sx={{ overflowY: 'scroll' }}
          p={1}
          gap={1}
        >
          <Typography variant="h4">ORDERS</Typography>
          <Stack gap={1} width="100%" px={0.5}>
            {data.orders?.map((order, i) => (
              <Button
                variant="outlined"
                key={`listing-${i}`}
                sx={{ color: 'text.primary', p: 1, height: '100px' }}
                onClick={() => selectOrder(order)}
              >
                <Stack width="100%" gap={0.5}>
                  <Row justifyContent="space-between">
                    <Typography variant="body1">price per pod</Typography>
                    <Typography variant="body1">
                      {displayBN(order.pricePerPod)}
                    </Typography>
                  </Row>
                  <Row justifyContent="space-between">
                    <Typography variant="body1">max place in line</Typography>
                    <Typography variant="body1">
                      {displayBN(order.maxPlaceInLine)}
                    </Typography>
                  </Row>
                  <Row justifyContent="space-between">
                    <Typography variant="body1">amount</Typography>
                    <Typography variant="body1">
                      {displayBN(order.podAmountRemaining)}
                    </Typography>
                  </Row>
                </Stack>
              </Button>
            ))}
          </Stack>
        </Stack>
        <Row gap={1} width="100%" alignItems="flex-start">
          <SelectedListingsTemp />
          <SelectedOrdersTemp />
        </Row>
      </Stack>
    </Stack>
  );
};

export default PodsChart;
