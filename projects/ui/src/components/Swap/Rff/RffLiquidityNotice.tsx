import React from 'react';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material';

import { FC } from '~/types';

type Props = {
  announcementUrl: string;
  onRequest: () => void;
};

const RffLiquidityNotice: FC<Props> = ({ announcementUrl, onRequest }) => (
  <Alert
    severity="warning"
    icon={<WarningAmberRoundedIcon />}
    sx={{
      alignItems: 'center',
      border: '1px solid',
      borderColor: 'warning.main',
      '& .MuiAlert-message': { width: '100%' },
    }}
  >
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      gap={1.5}
    >
      <Box>
        <Typography variant="bodyMedium" fontWeight="fontWeightBold">
          Liquidity removal notice
        </Typography>
        <Typography variant="bodySmall" color="text.secondary">
          Some swap liquidity is being removed. If a normal swap is unavailable,
          you can request a fill from Beanstalk Farms.{' '}
          {announcementUrl ? (
            <Link
              href={announcementUrl}
              target="_blank"
              rel="noreferrer"
              color="inherit"
              fontWeight="fontWeightBold"
            >
              Read the announcement →
            </Link>
          ) : null}
        </Typography>
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={onRequest}
        sx={{ flexShrink: 0 }}
      >
        Request a Fill
      </Button>
    </Stack>
  </Alert>
);

export default RffLiquidityNotice;
