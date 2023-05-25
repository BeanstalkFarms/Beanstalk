import { Button, Stack, Typography } from '@mui/material';
import React from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link as RouterLink } from 'react-router-dom';
import { GovSpace } from '~/lib/Beanstalk/Governance';

import { BeanstalkPalette, IconSize } from '../../App/muiTheme';
import { STALK } from '~/constants/tokens';
import { GOV_SLUGS, displayFullBN, getGovSpaceWithTab } from '~/util';
import Row from '../../Common/Row';
import TokenIcon from '../../Common/TokenIcon';
import useAccount from '~/hooks/ledger/useAccount';
import beanNFTIconDark from '~/img/tokens/beanft-dark-logo.svg';
import useFarmerVotingPower from '~/hooks/farmer/useFarmerVotingPower';

const VotingPowerBanner: React.FC<{
  tab: number;
  votingPower: ReturnType<typeof useFarmerVotingPower>['votingPower'];
}> = ({ tab, votingPower }) => {
  const account = useAccount();
  const space = getGovSpaceWithTab(tab);

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
      to={`/governance/vp/${GOV_SLUGS[tab]}`}
      component={RouterLink}
    >
      <Row justifyContent="space-between" width="100%" p={2}>
        <Stack gap={1}>
          <Typography variant="h4" textAlign="left">
            {space.toString()}
          </Typography>
          <Typography color="text.secondary">
            Your total number of votes includes your own&nbsp;
            {isNFT ? 'BeaNFTs' : 'Stalk'} and {isNFT ? 'BeaNFTs' : 'Stalk'}
            &nbsp;delegated to you by others.
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
                {votingPower.total.gt(0)
                  ? displayFullBN(votingPower.total, 0)
                  : '0'}
                &nbsp;BEANFT
              </Typography>
            </Row>
          ) : (
            <Row gap={0.3}>
              <TokenIcon token={STALK} css={{ height: IconSize.small }} />
              <Typography variant="bodyLarge">
                {votingPower.total.gt(0)
                  ? displayFullBN(votingPower.total, 0)
                  : '0'}
                &nbsp;STALK
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
