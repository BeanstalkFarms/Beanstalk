import { Typography } from '@mui/material';
import React from 'react';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';

import { FC } from '~/types';
import useBeanEthStartMintingSeason from '~/hooks/beanstalk/useBeanEthStartMintingSeason';
import Chop from './Chop';

const ChopActions: FC<{}> = () => {
  const { mintAllowed, MigrationAlert } = useBeanEthStartMintingSeason();

  return (
    <Module>
      <ModuleHeader>
        <Typography variant="h4">Chop</Typography>
      </ModuleHeader>
      <ModuleContent>{mintAllowed ? <Chop /> : MigrationAlert}</ModuleContent>
    </Module>
  );
};

export default ChopActions;
