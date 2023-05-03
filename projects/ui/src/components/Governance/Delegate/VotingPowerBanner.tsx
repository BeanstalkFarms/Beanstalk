import { Button, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link as RouterLink } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import { GovSpace } from '~/lib/Beanstalk/Governance';

import { BeanstalkPalette, IconSize } from '../../App/muiTheme';
import { ZERO_BN } from '~/constants';
import { STALK } from '~/constants/tokens';
import { displayFullBN } from '~/util';
import Row from '../../Common/Row';
import TokenIcon from '../../Common/TokenIcon';
import { FarmerDelegation } from '~/state/farmer/delegations';
import useAccount from '~/hooks/ledger/useAccount';
import beanNFTIconDark from '~/img/tokens/beanft-dark-logo.svg';

const VotingPowerBanner: React.FC<{
  tab: number;
  getSlug: (_tab: number) => string;
  space: GovSpace;
  farmerDelegations: FarmerDelegation;
}> = ({ tab, space, getSlug, farmerDelegations }) => {
  const account = useAccount();

  const totalVP = useMemo(() => {
    const _delegation = Object.values(
      farmerDelegations.votingPower[space] || []
    );
    return _delegation.reduce<BigNumber>(
      (acc, curr) => acc.plus(curr),
      ZERO_BN
    );
  }, [farmerDelegations.votingPower, space]);

  const isNFT = space === GovSpace.BeanNFT;

  if (!account) return null;

  return (
    <Button
      variant="outlined"
      sx={{
        p: 0,
        height: '100%',
        borderColor: BeanstalkPalette.blue,
        color: 'text.primary',
        background: BeanstalkPalette.lightestBlue,
        ':hover': {
          background: BeanstalkPalette.lightestGreen,
          borderColor: 'primary.main',
        },
      }}
      to={`/governance/vp/${getSlug(tab)}`}
      component={RouterLink}
    >
      <Row justifyContent="space-between" width="100%" p={2}>
        <Stack gap={1}>
          <Typography variant="h4" textAlign="left">
            {space.toString()}
          </Typography>
          <Typography color="text.secondary">
            Your total number of votes includes your own{' '}
            {isNFT ? 'BeaNFTs' : 'Stalk'} and {isNFT ? 'BeaNFTs' : 'Stalk'}{' '}
            delegated to you by others.
          </Typography>
          {space === GovSpace.BeanNFT ? (
            <Row gap={0.3}>
              <img
                src={beanNFTIconDark}
                alt="beanft"
                css={{
                  height: IconSize.small,
                  width: IconSize.small,
                  marginBottom: '2px',
                }}
              />
              <Typography variant="bodyLarge">
                {displayFullBN(totalVP, 0)} BEANFT
              </Typography>
            </Row>
          ) : (
            <Row gap={0.3}>
              <TokenIcon token={STALK} css={{ height: IconSize.small }} />
              <Typography variant="bodyLarge">
                {displayFullBN(totalVP, 0)} STALK
              </Typography>
            </Row>
          )}
        </Stack>
        <ChevronRightIcon
          sx={{ color: 'inherit', height: '24px', width: '24px' }}
        />
      </Row>
    </Button>
  );
};

export default VotingPowerBanner;
