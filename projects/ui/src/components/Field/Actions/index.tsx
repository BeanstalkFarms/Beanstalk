import React from 'react';
import { Box, Card, Stack, Tab, Tabs } from '@mui/material';
import useTabs from '~/hooks/display/useTabs';
import BadgeTab from '~/components/Common/BadgeTab';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import Sow from './Sow';
import Transfer from './Transfer';
import Harvest from './Harvest';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

const SLUGS = ['sow', 'transfer', 'harvest'];

const FieldActions : FC<{}> = () => {
  const [tab, handleChange] = useTabs(SLUGS, 'action');
  const farmerField = useFarmerField();
  return (
    <Card sx={{ position: 'relative' }}>
      <Stack gap={1.5}>
        {/* Header */}
        <Row justifyContent="space-between" sx={{ overflow: 'visible', px: 2, pt: 2 }}>
          <Tabs value={tab} onChange={handleChange} sx={{ minHeight: 0, overflow: 'visible', '& .MuiTabs-scroller': { overflow: 'visible' } }} variant="scrollable">
            <Tab label="Sow" />
            <Tab label="Transfer" />
            <BadgeTab label="Harvest" showBadge={farmerField.harvestablePods.gt(0)} />
          </Tabs>
        </Row>
        <Box sx={{ px: 1, pb: 1 }}>
          {tab === 0 && <Sow />}
          {tab === 1 && <Transfer />}
          {tab === 2 && <Harvest />}
        </Box>
      </Stack>
    </Card>
  );
};

export default FieldActions;
