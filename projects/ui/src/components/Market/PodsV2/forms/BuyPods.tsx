import { Stack, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { PodOrderType, podsOrderTypeAtom } from '../info/atom-context';
import Soon from '~/components/Common/ZeroState/Soon';
import CreateOrder from '~/components/Market/PodsV2/Actions/Buy/CreateOrder';
import usePodListing from '~/hooks/beanstalk/usePodListing';
import StatHorizontal from '~/components/Common/StatHorizontal';
import { displayBN, displayFullBN } from '~/util';
import { BEAN, PODS } from '~/constants/tokens';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';

const BuyPods: React.FC<{}> = () => {
  const orderType = useAtomValue(podsOrderTypeAtom);
  const { listingID } = useParams<{ listingID: string }>();
  const { data: listing } = usePodListing(listingID);

  return (
    <Stack p={1} gap={1}>
      {/* ORDER & FILL / LIST & FILL */}
      {/* <SubActionSelect /> */}
      {/* Stats */}
      {listing && orderType === PodOrderType.FILL && (
        <div>
          <StatHorizontal label="Place in Line">
            {displayBN(listing.placeInLine)}
          </StatHorizontal>
          <StatHorizontal label="Price per Pod">
            <Row gap={0.25}>
              <TokenIcon token={BEAN[1]} />{' '}
              {displayFullBN(listing.pricePerPod, 4, 2)}
            </Row>
          </StatHorizontal>
          <StatHorizontal label="Amount">
            <Row gap={0.25}>
              <TokenIcon token={PODS} />{' '}
              {displayFullBN(listing.remainingAmount, 2, 0)}
            </Row>
          </StatHorizontal>
        </div>
      )}
      {orderType === PodOrderType.ORDER && <CreateOrder />}
      {orderType === PodOrderType.FILL && (
        <>
          {listingID ? (
            <Outlet />
          ) : (
            <Soon>
              <Typography textAlign="center" color="gray">
                Select a Pod Listing on the chart to buy from.
              </Typography>
            </Soon>
          )}
        </>
      )}
    </Stack>
  );
};

export default BuyPods;
