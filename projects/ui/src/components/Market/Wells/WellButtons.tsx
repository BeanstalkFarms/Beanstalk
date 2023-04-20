import React from 'react';
import {
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import downloadIcon from '~/img/beanstalk/interface/download.svg';
import Row from '~/components/Common/Row';

const WellButtons: React.FC = () => (
  <Stack direction="row" gap={1} alignItems="end" height="100%">
    <Button
      component={Link}
      to="/swap"
      color="light"
      variant="contained"
      sx={{ py: 1 }}
    >
      <Typography variant="h4">Trade</Typography>
    </Button>
    <Button
      component={Link}
      to="/silo"
      color="primary"
      variant="contained"
      sx={{ py: 1 }}
    >
      {/* <DownloadIcon /> */}
      <Row gap={0.5}>
        <img src={downloadIcon} alt="" />
        <Typography variant="h4">Add Liquidity</Typography>
      </Row>
    </Button>
  </Stack>
);

export default WellButtons;
