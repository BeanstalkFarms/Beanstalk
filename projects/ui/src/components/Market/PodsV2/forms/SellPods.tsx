import { Stack, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { PodOrderType, podsOrderTypeAtom } from '../info/atom-context';
import CreateListingV2 from '~/components/Market/PodsV2/Actions/Sell/CreateListing';
import Soon from '~/components/Common/ZeroState/Soon';
import StatHorizontal from '~/components/Common/StatHorizontal';
import { displayBN, displayFullBN } from '~/util';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import { BEAN, PODS } from '~/constants/tokens';
import usePodOrder from '~/hooks/beanstalk/usePodOrder';

const SellPods: React.FC<{}> = () => {
  const orderType = useAtomValue(podsOrderTypeAtom);
  const { orderID } = useParams<{ orderID: string }>();
  const { data: order } = usePodOrder(orderID);

  return (
    <Stack>
      <Stack p={1} gap={1}>
        {/* buy or sell toggle */}
        {/* <SubActionSelect /> */}
        {order && orderType === PodOrderType.FILL && (
          <>
            <StatHorizontal
              label="Place in Line"
              labelTooltip="Any Pod in this range is eligible to sell to this Order."
            >
              0 - {displayBN(order.maxPlaceInLine)}
            </StatHorizontal>
            <StatHorizontal label="Price per Pod">
              <Row gap={0.25}>
                <TokenIcon token={BEAN[1]} />{' '}
                {displayFullBN(order.pricePerPod, 4, 2)}
              </Row>
            </StatHorizontal>
            <StatHorizontal label="Amount">
              <Row gap={0.25}>
                <TokenIcon token={PODS} />{' '}
                {displayFullBN(order.podAmountRemaining, 2, 0)}
              </Row>
            </StatHorizontal>
          </>
        )}
        {/* create buy order */}
        {/* {orderType === PodOrderType.ORDER && <CreateBuyOrder />} */}
        {orderType === PodOrderType.LIST && <CreateListingV2 />}
        {/* fill sell order */}
        {/* {orderType === PodOrderType.FILL && <FillBuyListing />} */}
        {orderType === PodOrderType.FILL && (
          <>
            {orderID ? (
              <Outlet />
            ) : (
              <Soon>
                <Typography textAlign="center" color="gray">
                  Select a pod order on the chart to sell to.
                </Typography>
              </Soon>
            )}
          </>
        )}
      </Stack>
      {/* <Divider /> */}
      {/* submit buy order */}
      {/* <Stack p={0.8}> */}
      {/*  <SubmitMarketAction /> */}
      {/* </Stack> */}
    </Stack>
  );
};

export default SellPods;
