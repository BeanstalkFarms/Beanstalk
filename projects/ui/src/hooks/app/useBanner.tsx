import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import Banner from '~/components/Nav/Banner';
import { BANNER_HEIGHT } from '~/hooks/app/usePageDimensions';
import { AppState } from '~/state';
import { ActiveProposal } from '~/state/beanstalk/governance';
import snapshotLogo from '~/img/ecosystem/snapshot-logo.svg';
import useMigrationNeeded from '~/hooks/farmer/useMigrationNeeded';

const useBanner = () => {
  const migrationNeeded = useMigrationNeeded();
  const activeProposals = useSelector<AppState, ActiveProposal[]>(
    (state) => state._beanstalk.governance.activeProposals
  );

  return useMemo(() => {
    return (
      <Banner height={BANNER_HEIGHT}>
        BIP-38 Unripe liquidity migration is in process. Quotes will be affected
        until the migration is complete. See&nbsp;
        <a
          href="https://discord.gg/beanstalk"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </a>
        &nbsp;for more information.
      </Banner>
    );

    // eslint-disable-next-line no-unreachable
    if (migrationNeeded === true) {
      return (
        <Banner height={BANNER_HEIGHT} to="/silo?view=migrate">
          Silo V3 is here.&nbsp;&nbsp;
          <strong>Migrate now &rarr;</strong>
        </Banner>
      );
    }
    if (activeProposals.length > 1) {
      return (
        <Banner height={BANNER_HEIGHT} to="/governance">
          <img
            src={snapshotLogo}
            alt="Snapshot"
            css={{ height: 14, marginBottom: -2 }}
          />
          &nbsp;&nbsp;
          {activeProposals.length} governance proposals are live.&nbsp;
          <strong>Vote now &rarr;</strong>
        </Banner>
      );
    }
    if (activeProposals.length === 1) {
      return (
        <Banner
          height={BANNER_HEIGHT}
          to={`/governance/${activeProposals[0].id}`}
        >
          <img
            src={snapshotLogo}
            alt="Snapshot"
            css={{ height: 14, marginBottom: -2 }}
          />
          &nbsp;&nbsp;
          <Box display={{ xs: 'inline', md: 'none' }}>
            {activeProposals[0].title.substring(0, 35)}...&nbsp;
            <strong>Vote now &rarr;</strong>
          </Box>
          <Box display={{ xs: 'none', md: 'inline' }}>
            {activeProposals[0].title} is live.&nbsp;
            <strong>Vote now &rarr;</strong>
          </Box>
        </Banner>
      );
    }
    return null;
  }, [activeProposals, migrationNeeded]);
};

export default useBanner;
