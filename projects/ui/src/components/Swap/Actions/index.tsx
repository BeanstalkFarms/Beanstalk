import { Typography } from '@mui/material';
import React from 'react';
import { Module, ModuleContent, ModuleHeader } from '~/components/Common/Module';
import Swap from '~/components/Swap/Actions/Swap';

import { FC } from '~/types';

const SwapActions : FC<{}> = () => (
  <Module>
    <ModuleHeader>
      <Typography variant="h4">Swap</Typography>  
    </ModuleHeader>
    <ModuleContent>
      <Swap />
    </ModuleContent>
  </Module>
);
export default SwapActions;
