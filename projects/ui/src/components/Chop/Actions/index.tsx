import { Typography } from '@mui/material';
import React from 'react';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';

import { FC } from '~/types';
import Chop from './Chop';

const ChopActions: FC<{}> = () => (
  <Module>
    <ModuleHeader>
      <Typography variant="h4">Chop</Typography>
    </ModuleHeader>
    <ModuleContent>
      <Chop />
    </ModuleContent>
  </Module>
);

export default ChopActions;
