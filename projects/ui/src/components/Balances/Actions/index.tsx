import { Stack } from '@mui/material';
import React from 'react';
import ClaimSiloRewards from './ClaimSiloRewards';
import QuickHarvest from './QuickHarvest';
import QuickRinse from './QuickRinse';
import useBanner from '~/hooks/app/useBanner';
import useNavHeight from '~/hooks/app/usePageDimensions';

const BalancesActions: React.FC<{}> = () => {
  const banner = useBanner();
  const navHeight = useNavHeight(!!banner);
  return (
    <Stack
      width={{ xs: '100%', lg: '360px' }}
      sx={{
        flexShrink: 0,
        position: { md: 'sticky', xs: 'block' },
        top: `${navHeight + 20}px`,
      }}
      gap={{ xs: 2, lg: 1 }}
    >
      <QuickHarvest />
      <QuickRinse />
      <ClaimSiloRewards />
    </Stack>
  );
};

export default BalancesActions;
