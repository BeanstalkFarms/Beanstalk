import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useSelector } from 'react-redux';
import Dot from '~/components/Common/Dot';
import {
  Module,
  ModuleContent,
} from '~/components/Common/Module';
import Row from '~/components/Common/Row';
import Harvest from '~/components/Field/Actions/Harvest';
import { AppState } from '~/state';

const QuickHarvest: React.FC<{}> = () => {
  const farmerField = useSelector<AppState, AppState['_farmer']['field']>(
    (state) => state._farmer.field
  );

  return farmerField.harvestablePods?.gt(0) ? (
    <Module sx={{ width: '100%' }}>      
      <ModuleContent pt={1.5} px={1} pb={1}>
        <Stack spacing={1.5}>
          <Row spacing={0.5} px={0.5}>
            <Dot color="primary.main" />
            <Typography variant="h4">Quick Harvest</Typography>
          </Row>
          <Harvest quick />
        </Stack>
      </ModuleContent>
    </Module>
  ) : null;
};

export default QuickHarvest;
