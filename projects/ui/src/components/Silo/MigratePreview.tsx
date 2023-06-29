import React from 'react';
import { Box } from '@mui/material';
import { FC } from '~/types';
import Row from '~/components/Common/Row';

export const MigratePreview: FC<{}> = () => (
  <Row p={2}>
    <Box flex={2}>Go</Box>
    <Box flex={1}>FAQ</Box>
  </Row>
);
