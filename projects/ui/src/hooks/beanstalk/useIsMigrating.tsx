import React, { useMemo } from 'react';
import { Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { DISCORD_LINK } from '~/constants';
import WarningAlert from '~/components/Common/Alert/WarningAlert';

export default function useIsMigrating() {
  const MigrationAlert = useMemo(
    () => (
      <Stack width="100%" boxSizing="border-box" sx={{}}>
        <WarningAlert>
          <Typography component="span">
            During the BIP-48 Unripe liquidity migration process, Unripe
            Deposits, Converts and Chops are disabled. Follow the Beanstalk{' '}
            <Link
              to={DISCORD_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', color: 'inherit' }}
            >
              Discord
            </Link>{' '}
            for more information.
          </Typography>
        </WarningAlert>
      </Stack>
    ),
    []
  );

  return {
    isMigrating: true,
    MigrationAlert,
  };
}
