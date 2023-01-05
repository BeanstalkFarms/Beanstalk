 import React from 'react';
import { Container, Stack } from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import RemainingFertilizer from '~/components/Barn/RemainingFertilizer';
import MyFertilizer from '~/components/Barn/MyFertilizer';
import BarnActions from '~/components/Barn/Actions';
import GuideButton from '~/components/Common/Guide/GuideButton';
 import { HOW_TO_BUY_FERTILIZER, HOW_TO_RINSE_SPROUTS, HOW_TO_TRANSFER_FERTILIZER, HOW_TO_TRADE_FERTILIZER } from '~/util/Guides';

import { FC } from '~/types';

const Barn: FC<{}> = () => (
  <Container maxWidth="sm">
    <Stack gap={2}>
      <PageHeader
        title="The Barn"
        description="Earn yield and recapitalize Beanstalk with Fertilizer"
        href="https://docs.bean.money/almanac/farm/barn"
        OuterStackProps={{ direction: 'row' }}
        control={
          <GuideButton
            title="The Farmers' Almanac: Barn Guides"
            guides={[
              HOW_TO_BUY_FERTILIZER,
              HOW_TO_RINSE_SPROUTS,
              HOW_TO_TRANSFER_FERTILIZER, 
              HOW_TO_TRADE_FERTILIZER,
            ]}
          />
        }
      />
      {/* Section 1: Fertilizer Remaining */}
      <RemainingFertilizer />
      {/* Section 2: Purchase Fertilizer */}
      <BarnActions />
      {/* Section 3: My Fertilizer */}
      <MyFertilizer />
    </Stack>
  </Container>
);

export default Barn;
