import { Box, Stack } from '@mui/material';
import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import SubActionSelect from '~/components/Market/PodsV2/Common/SubActionSelect';

const Buy: React.FC<{}> = () => {
  const { listingID } = useParams<{ listingID?: string }>();
  return (
    <Stack px={0.8} py={0.8} gap={1.2}>
      <Box>
        <SubActionSelect
          action="buy"
          id={listingID}
        />
      </Box>
      {/* Order or Fill form */}
      <Outlet />
    </Stack>
  );
};

export default Buy;
