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
      bgcolor: '#fff2d6',
      px: { xs: 1.25, sm: 1.5 },
      py: 1,
      '& .MuiAlert-icon': {
        alignItems: 'center',
        mr: 1.25,
        py: 0,
      },
      '& .MuiAlert-message': { width: '100%', py: 0 },
    }}
  >
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      gap={1.25}
    >
      <Box minWidth={0}>
        <Typography
          variant="bodySmall"
          fontWeight="fontWeightBold"
          display="block"
          lineHeight={1.3}
        >
          Liquidity removal notice
        </Typography>
        <Typography
          variant="bodySmall"
          color="text.secondary"
          display="block"
          mt={0.25}
          lineHeight={1.4}
        >
          The BCM elected to migrate the majority of the liquidity owned by
          Beanstalk into a custodial multisig to protect against a potential
          exploit facilitated by rapidly accelerating AI models. Swapping on
          the UI may have higher slippage as a result. Users can elect to swap
          with the full reserves by submitting a Request For Fill (RFF).{' '}
          {announcementUrl ? (
            <Link
              href={announcementUrl}
              target="_blank"
              rel="noreferrer"
              color="inherit"
              fontWeight="fontWeightBold"
            >
              Read more about it here
            </Link>
          ) : (
            'Read more about it here'
          )}
          .
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        color="primary"
        onClick={onRequest}
        sx={{
          flexShrink: 0,
          alignSelf: { xs: 'stretch', sm: 'center' },
          whiteSpace: 'nowrap',
          px: 1.75,
        }}
      >
        Request a Fill
      </Button>
    </Stack>
  </Alert>
);

export default RffLiquidityNotice;
