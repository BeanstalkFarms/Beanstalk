import React from 'react';
import {
  Container, Stack,
} from '@mui/material';
import SwapActions from '~/components/Swap/Actions';
import PageHeader from '~/components/Common/PageHeader';
import GuideButton from '~/components/Common/Guide/GuideButton';
import { HOW_TO_TRANSFER_FARM_BALANCE, HOW_TO_TRADE_BEANS } from '~/util/Guides';

import { FC } from '~/types';

const SwapPage: FC<{}> = () => (
  <Container maxWidth="sm">
    <Stack gap={2}>
      <PageHeader
        title="Swap"
        description="Trade Beans and transfer Beanstalk assets"
        href="https://docs.bean.money/almanac/guides/swap"
        control={
          <GuideButton
            title="The Farmers' Almanac: Swap Guides"
            guides={[
              HOW_TO_TRADE_BEANS,
              HOW_TO_TRANSFER_FARM_BALANCE,
            ]}
          />
        }
      />
      <SwapActions />
    </Stack>
  </Container>
);
export default SwapPage;
