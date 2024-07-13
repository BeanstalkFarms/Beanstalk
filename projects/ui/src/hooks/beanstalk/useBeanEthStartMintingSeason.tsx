import { useAppSelector } from '~/state';
import React, { useMemo } from 'react';
import { Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { DISCORD_LINK } from '~/constants';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import useSeason from './useSeason';

export default function useBeanEthStartMintingSeason() {
  const season = useSeason();
  const allowedMintSeason = useAppSelector(
    (s) => s._beanstalk.sun.season.beanEthStartMintingSeason
  );

  const mintAllowed = useMemo(
    () => (allowedMintSeason ? season.gte(allowedMintSeason) : true),
    [allowedMintSeason, season]
  );

  const MigrationAlert = useMemo(
    () => (
      <Stack width="100%" boxSizing="border-box" sx={{}}>
        <WarningAlert
        // color="error"
        >
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
    season: allowedMintSeason,
    mintAllowed,
    MigrationAlert,
  };
}
