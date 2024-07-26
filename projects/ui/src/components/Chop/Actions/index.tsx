import { Typography } from '@mui/material';
import React from 'react';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';

import { FC } from '~/types';
import useIsMigrating from '~/hooks/beanstalk/useIsMigrating';
import Chop from './Chop';

const ChopActions: FC<{}> = () => {
  const { isMigrating, MigrationAlert } = useIsMigrating();

  return (
    <Module>
      <ModuleHeader>
        <Typography variant="h4">Chop</Typography>
      </ModuleHeader>
      <ModuleContent>{!isMigrating ? <Chop /> : MigrationAlert}</ModuleContent>
    </Module>
  );
};

export default ChopActions;
